import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { parseTireSize } from '../../core/fitment';

/**
 * Drum-style size selection: three vertical wheels (width / sidewall / rim),
 * timer-app style — drag, flick, or mouse-scroll; the row locked in the
 * centre band is the selection. Values are the increments the industry
 * actually sells.
 *
 * Only metric sizes decompose into these three dials — for a flotation base
 * the caller falls back to free-text entry.
 */

const WIDTHS = range(155, 355, 10);
const ASPECTS = range(25, 80, 5);
const RIMS = range(14, 24, 1);

const ITEM_H = 38;
const VISIBLE = 3; // one neighbour visible above and below the selection

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/** Option list including an off-scale current value, kept sorted. */
function withValue(options: number[], value: number): number[] {
  if (options.includes(value)) return options;
  return [...options, value].sort((a, b) => a - b);
}

export default function SizePickers({
  value,
  base,
  onChange,
}: {
  /** The working size; when unreadable/empty, `base` supplies the dials. */
  value: string;
  base: string;
  onChange: (size: string) => void;
}) {
  const shown = parseTireSize(value) ?? parseTireSize(base);
  if (!shown || shown.kind !== 'metric') return null;

  const width = Math.round(shown.sectionWidthMm);
  const aspect = Math.round(shown.aspectRatio);
  const rim = shown.rimDiameterIn;

  const build = (w: number, a: number, r: number) => onChange(`${w}/${a}R${r}`);

  return (
    <View style={styles.block}>
      <Drum
        label="Width"
        options={withValue(WIDTHS, width).map(String)}
        selected={String(width)}
        onSelect={(v) => build(Number(v), aspect, rim)}
      />
      <Drum
        label="Sidewall"
        options={withValue(ASPECTS, aspect).map(String)}
        selected={String(aspect)}
        onSelect={(v) => build(width, Number(v), rim)}
      />
      <Drum
        label="Wheel"
        options={withValue(RIMS, rim).map((r) => `${r}"`)}
        selected={`${rim}"`}
        onSelect={(v) => build(width, aspect, Number(v.replace('"', '')))}
      />
    </View>
  );
}

function Drum({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, options.indexOf(selected));
  // What the wheel is visually locked on — also styles the centre row while
  // a gesture is still in flight.
  const [liveIndex, setLiveIndex] = useState(selectedIndex);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The index this drum last reported; distinguishes our own echo from an
  // external change (chip tap, other drum rebuilding the size).
  const reported = useRef(selectedIndex);
  const y = useRef(selectedIndex * ITEM_H);

  const scrollToIndex = (idx: number, animated: boolean) =>
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated });

  // Mount + external selection changes: put the wheel where the value is.
  useEffect(() => {
    if (reported.current !== selectedIndex) {
      reported.current = selectedIndex;
      setLiveIndex(selectedIndex);
      scrollToIndex(selectedIndex, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, options.join(',')]);

  const settle = (idx: number) => {
    const clamped = Math.min(options.length - 1, Math.max(0, idx));
    scrollToIndex(clamped, true);
    if (clamped !== reported.current) {
      reported.current = clamped;
      onSelect(options[clamped]);
    }
  };

  /** Debounced snap: fires once the scroll (drag, flick, or wheel) goes quiet. */
  const armSnap = () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => settle(Math.round(y.current / ITEM_H)), 160);
  };

  // Web: wheel, click-drag, and pacing — none of which the native scroll
  // surface gives a mouse on its own.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (scrollRef.current as any)?.getScrollableNode?.() as HTMLElement | undefined;
    if (!node) return;

    const NOTCH = 80; // raw wheel delta that advances one row
    let acc = 0;
    let lastWheelAt = 0;
    // Where the drum is headed. Steps chain onto this, not onto scrollTop —
    // reading scrollTop mid-glide would lose the queued distance.
    let targetY: number | null = null;
    // Hand-rolled glide: the browser's smooth scrollTo and the snap logic
    // fight each other (interrupted native glides land anywhere), so ease
    // scrollTop over a few frames ourselves.
    let anim = 0;
    const glideTo = (to: number) => {
      cancelAnimationFrame(anim);
      const fromY = node.scrollTop;
      const start = performance.now();
      const DURATION = 160;
      const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
      const frame = (t: number) => {
        const k = Math.min(1, (t - start) / DURATION);
        node.scrollTop = fromY + (to - fromY) * easeOut(k);
        if (k < 1) anim = requestAnimationFrame(frame);
      };
      anim = requestAnimationFrame(frame);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * NOTCH : e.deltaY;
      // Leftover from a previous gesture must not stack onto a fresh notch —
      // discrete clicks land >150ms apart, trackpad streams well under.
      if (e.timeStamp - lastWheelAt > 150 || Math.sign(delta) !== Math.sign(acc)) {
        acc = 0;
        targetY = null;
      }
      lastWheelAt = e.timeStamp;
      let steps: number;
      if (Math.abs(delta) >= NOTCH) {
        // A discrete wheel click (typically 100–120 raw) is exactly one row,
        // no matter how fast clicks repeat; huge accelerated deltas scale.
        steps = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / 120));
        acc = 0;
      } else {
        // Trackpad stream: accumulate the small deltas into rows.
        acc += delta;
        steps = Math.trunc(acc / NOTCH);
        acc -= steps * NOTCH;
      }
      if (steps !== 0) {
        const max = node.scrollHeight - node.clientHeight;
        const from = targetY ?? node.scrollTop;
        // Snap the target to the row grid so every glide lands centred.
        targetY = Math.min(max, Math.max(0, Math.round(from / ITEM_H + steps) * ITEM_H));
        glideTo(targetY);
      }
    };

    // Click-and-drag with a mouse. Touch drags scroll natively; this is only
    // for the pointer type that doesn't. Capture starts only after real
    // movement — capturing on pointerdown would retarget the click away from
    // the row underneath and break plain tap-to-select.
    const DRAG_THRESHOLD = 5;
    let tracking = false;
    let dragging = false;
    let lastY = 0;
    let moved = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      tracking = true;
      dragging = false;
      moved = 0;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!tracking) return;
      const dy = e.clientY - lastY;
      lastY = e.clientY;
      moved += Math.abs(dy);
      if (!dragging && moved > DRAG_THRESHOLD) {
        dragging = true;
        node.setPointerCapture?.(e.pointerId);
        node.style.cursor = 'grabbing';
      }
      if (dragging) node.scrollTop -= dy;
    };
    const onUp = (e: PointerEvent) => {
      tracking = false;
      if (!dragging) return;
      dragging = false;
      node.releasePointerCapture?.(e.pointerId);
      node.style.cursor = 'grab';
    };
    // A real drag must not count as a tap on whatever row it ends over.
    const onClick = (e: MouseEvent) => {
      if (moved > DRAG_THRESHOLD) {
        e.stopPropagation();
        e.preventDefault();
        moved = 0;
      }
    };

    node.style.cursor = 'grab';
    node.style.userSelect = 'none';
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
    node.addEventListener('click', onClick, true);
    return () => {
      cancelAnimationFrame(anim);
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
  }, []);

  const pad = (ITEM_H * (VISIBLE - 1)) / 2;

  return (
    <View style={styles.drumColumn}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.drumFrame}>
        <View pointerEvents="none" style={styles.centerBand} />
      <ScrollView
        ref={scrollRef}
        style={styles.drum}
        contentContainerStyle={{ paddingVertical: pad }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={ITEM_H}
        onLayout={() => scrollToIndex(reported.current, false)}
        onContentSizeChange={() => scrollToIndex(reported.current, false)}
        onScroll={(e) => {
          y.current = e.nativeEvent.contentOffset.y;
          const idx = Math.min(
            options.length - 1,
            Math.max(0, Math.round(y.current / ITEM_H)),
          );
          if (idx !== liveIndex) setLiveIndex(idx);
          armSnap();
        }}
        onMomentumScrollEnd={() => settle(Math.round(y.current / ITEM_H))}
      >
        {options.map((o, i) => (
          <Pressable
            key={o}
            onPress={() => {
              if (snapTimer.current) clearTimeout(snapTimer.current);
              setLiveIndex(i);
              settle(i);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: o === selected }}
            accessibilityLabel={`${label} ${o}`}
            style={styles.item}
          >
            <Text
              style={[
                styles.itemText,
                i === liveIndex
                  ? styles.itemTextOn
                  : Math.abs(i - liveIndex) === 1
                    ? styles.itemTextNear
                    : styles.itemTextFar,
              ]}
            >
              {o}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  drumColumn: { flex: 1, alignItems: 'stretch' },
  label: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  drumFrame: { position: 'relative' },
  drum: { height: ITEM_H * VISIBLE },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontWeight: '700' },
  itemTextOn: { color: colors.text, fontSize: 20 },
  itemTextNear: { color: colors.textDim, fontSize: 15, opacity: 0.8 },
  itemTextFar: { color: colors.textDim, fontSize: 14, opacity: 0.35 },
  centerBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (ITEM_H * (VISIBLE - 1)) / 2,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.accentSoft,
    opacity: 0.35,
    borderRadius: 10,
  },
});

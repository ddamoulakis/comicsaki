import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { theme } from '@/constants/Theme';

type BubbleKind = 'speech' | 'thought';

type SpeechBubbleProps = ViewProps & {
  fill?: string;
  ink?: string;
  compact?: boolean;
  /** speech = oval + pointer; thought = cloud + trail circles. */
  kind?: BubbleKind;
  /** Flip bubble decorations horizontally (text stays readable). */
  mirror?: boolean;
};

/**
 * Classic comic bubble. Shape can be mirrored without flipping children text.
 */
export function SpeechBubble({
  children,
  style,
  fill = '#FFFFFF',
  ink = theme.cosmicInk,
  compact = false,
  kind = 'speech',
  mirror = false,
  ...rest
}: SpeechBubbleProps) {
  const flip = mirror ? ({ transform: [{ scaleX: -1 }] } as ViewStyle) : undefined;

  const decorations =
    kind === 'thought' ? (
      <>
        <View style={styles.trail} pointerEvents="none">
          <View style={[styles.trailDot, styles.trailDotLg, { borderColor: ink, backgroundColor: fill }]} />
          <View style={[styles.trailDot, styles.trailDotMd, { borderColor: ink, backgroundColor: fill }]} />
          <View style={[styles.trailDot, styles.trailDotSm, { borderColor: ink, backgroundColor: fill }]} />
        </View>
        <View style={styles.spark} pointerEvents="none">
          <View style={[styles.sparkLine, { backgroundColor: ink }]} />
          <View style={[styles.sparkLine, styles.sparkLineMid, { backgroundColor: ink }]} />
          <View style={[styles.sparkLine, styles.sparkLineShort, { backgroundColor: ink }]} />
        </View>
      </>
    ) : null;

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        kind === 'thought' && styles.wrapThought,
        kind === 'speech' && styles.wrapSpeech,
        style,
      ]}
      {...rest}>
      {/* Shape layer — mirrored independently so text stays upright */}
      <View style={[styles.shapeLayer, flip]} pointerEvents="none">
        <View
          style={[
            styles.nativeBody,
            compact && styles.nativeBodyCompact,
            kind === 'thought' && styles.nativeThought,
            { backgroundColor: fill, borderColor: ink },
          ]}
        />
        {kind === 'speech' ? (
          <>
            <View style={[styles.tailInk, { borderTopColor: ink }]} />
            <View style={[styles.tailFill, { borderTopColor: fill }]} />
          </>
        ) : null}
        {decorations}
      </View>

      <View style={[styles.content, compact && styles.contentCompact]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'stretch',
    flex: 1,
    paddingBottom: 10,
  },
  wrapCompact: {
    paddingBottom: 8,
  },
  wrapThought: {
    paddingBottom: 16,
    paddingRight: 10,
  },
  wrapSpeech: {
    paddingBottom: 12,
  },
  shapeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  webInk: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  webFace: {
    ...StyleSheet.absoluteFillObject,
    margin: 3,
    marginBottom: 6,
    zIndex: 1,
  },
  webFaceCompact: {
    marginBottom: 5,
  },
  nativeBody: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: 999,
    zIndex: 1,
  },
  nativeBodyCompact: {
    borderRadius: 28,
  },
  nativeThought: {
    borderRadius: 40,
  },
  content: {
    zIndex: 2,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
    overflow: 'visible',
  },
  contentCompact: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tailInk: {
    position: 'absolute',
    right: 22,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 0,
  },
  tailFill: {
    position: 'absolute',
    right: 24,
    bottom: 3,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 2,
  },
  trail: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    zIndex: 2,
    alignItems: 'center',
    gap: 3,
  },
  trailDot: {
    borderWidth: 2.5,
    borderRadius: 999,
  },
  trailDotLg: {
    width: 10,
    height: 10,
    alignSelf: 'flex-start',
    marginLeft: 2,
  },
  trailDotMd: {
    width: 7,
    height: 7,
    alignSelf: 'center',
    marginLeft: 8,
  },
  trailDotSm: {
    width: 5,
    height: 5,
    alignSelf: 'flex-end',
  },
  spark: {
    position: 'absolute',
    top: 4,
    right: 6,
    zIndex: 2,
    gap: 3,
    alignItems: 'flex-end',
  },
  sparkLine: {
    width: 10,
    height: 2,
    transform: [{ rotate: '-28deg' }],
  },
  sparkLineMid: {
    width: 8,
    marginRight: 2,
  },
  sparkLineShort: {
    width: 6,
    marginRight: 4,
  },
  star: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    width: 6,
    height: 6,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  innerShine: {
    position: 'absolute',
    top: 10,
    left: 14,
    zIndex: 2,
  },
  shineArc: {
    width: 22,
    height: 14,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
    opacity: 0.55,
  },
});

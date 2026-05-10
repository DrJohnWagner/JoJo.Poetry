import {
  buildSemanticPressureOverlayLayers,
  composeSpec,
} from "../spec";
import { OVERLAY_TRANSFORM_DEFAULTS } from "../theme";
import type {
  ContourFillData,
  TopologyTraceData,
  RenderSpec,
  SemanticPressureData,
  VisConfig,
  VisData,
  VisType,
} from "../types";

interface OverlayApplyArgs {
  overlayType: string;
  hostVisType: VisType;
  hostData: VisData;
  overlayData: VisData;
  hostSpec: RenderSpec;
  cfg: VisConfig;
}

type OverlayMode = "additive" | "transform" | "segmentation" | "annotation";

interface OverlayHostPolicy {
  mode: OverlayMode;
  transformId?: string;
}

type OverlayHostPolicyMap = Partial<Record<VisType, OverlayHostPolicy>> & {
  __default?: OverlayHostPolicy;
};

// Overlay ontology:
// additive: overlay adds independent geometry.
// transform: overlay modifies host topology.
// segmentation: overlay partitions structural regions.
// annotation: overlay adds non-structural metadata.
const OVERLAY_RENDER_POLICY: Record<VisType, OverlayMode> = {
  indentation_map: "annotation",
  line_length_contour: "transform",
  line_length_distribution: "annotation",
  interruption_density_profile: "annotation",
  momentum_profile: "transform",
  stanza_architecture: "segmentation",
  punctuation_pressure_strip: "additive",
  fracture_map: "transform",
  semantic_pressure_overlay: "annotation",
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function toRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blendHex(a: string, b: string, t: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  if (!ca || !cb) return a;

  const p = clamp01(t);
  const r = Math.round(ca[0] * (1 - p) + cb[0] * p);
  const g = Math.round(ca[1] * (1 - p) + cb[1] * p);
  const bch = Math.round(ca[2] * (1 - p) + cb[2] * p);
  return `rgb(${r}, ${g}, ${bch})`;
}

function pressureMap(data: SemanticPressureData): Map<number, number> {
  return new Map(data.lines.map((line) => [line.lineIndex, clamp01(line.pressure)]));
}

function applyTopologyPressureTransform(
  hostSpec: RenderSpec,
  pressureByLine: Map<number, number>,
  cfg: VisConfig,
  opts: {
    minScale: number;
    maxScale: number;
    baseStrokeWidth: number;
    strokeBoost: number;
    fillOpacity: number;
    colorMix: number;
  },
): RenderSpec {
  const layers = hostSpec.layers.map((layer) => {
    if (layer.data.kind !== "topology_trace" && layer.data.kind !== "contour_fill") {
      return layer;
    }

    if (layer.data.kind === "topology_trace") {
      const points = layer.data.points.map((point, i) => {
        const pressure = pressureByLine.get(i) ?? 0;
        const scale = opts.minScale + (opts.maxScale - opts.minScale) * pressure;
        return { x: clamp01(point.x * scale), y: point.y };
      });

      const meanPressure = points.length
        ? points.reduce((acc, _, i) => acc + (pressureByLine.get(i) ?? 0), 0) / points.length
        : 0;

      const data: TopologyTraceData = { kind: "topology_trace", points };
      return {
        ...layer,
        data,
        style: {
          ...layer.style,
          stroke: blendHex(cfg.theme.fracture, cfg.theme.semantic, meanPressure * opts.colorMix),
          strokeWidth: opts.baseStrokeWidth + meanPressure * opts.strokeBoost,
        },
      };
    }

    const points = layer.data.points.map((point, i) => {
      const pressure = pressureByLine.get(i) ?? 0;
      const scale = opts.minScale + (opts.maxScale - opts.minScale) * pressure;
      return { x: clamp01(point.x * scale), y: point.y };
    });

    const data: ContourFillData = {
      kind: "contour_fill",
      points,
      baselineX: layer.data.baselineX,
    };

    return {
      ...layer,
      data,
      style: {
        ...layer.style,
        opacity: opts.fillOpacity,
      },
    };
  });

  return { ...hostSpec, layers };
}

function transformSemanticOnFractureMap(args: OverlayApplyArgs): RenderSpec {
  if (args.overlayData.kind !== "semantic_pressure_overlay") return args.hostSpec;
  if (args.hostData.kind !== "fracture_map") return args.hostSpec;
  return applyTopologyPressureTransform(
    args.hostSpec,
    pressureMap(args.overlayData),
    args.cfg,
    OVERLAY_TRANSFORM_DEFAULTS.fracture_map,
  );
}

function transformSemanticOnLineLengthContour(args: OverlayApplyArgs): RenderSpec {
  if (args.overlayData.kind !== "semantic_pressure_overlay") return args.hostSpec;
  if (args.hostData.kind !== "line_length_contour") return args.hostSpec;
  return applyTopologyPressureTransform(
    args.hostSpec,
    pressureMap(args.overlayData),
    args.cfg,
    OVERLAY_TRANSFORM_DEFAULTS.line_length_contour,
  );
}

function transformSemanticOnMomentumProfile(args: OverlayApplyArgs): RenderSpec {
  if (args.overlayData.kind !== "semantic_pressure_overlay") return args.hostSpec;
  if (args.hostData.kind !== "momentum_profile") return args.hostSpec;
  return applyTopologyPressureTransform(
    args.hostSpec,
    pressureMap(args.overlayData),
    args.cfg,
    OVERLAY_TRANSFORM_DEFAULTS.momentum_profile,
  );
}

const SEMANTIC_TRANSFORM_BY_HOST: Partial<Record<VisType, (args: OverlayApplyArgs) => RenderSpec>> = {
  fracture_map: transformSemanticOnFractureMap,
  line_length_contour: transformSemanticOnLineLengthContour,
  momentum_profile: transformSemanticOnMomentumProfile,
};

function applySemanticPressureTransform(args: OverlayApplyArgs): RenderSpec {
  if (OVERLAY_RENDER_POLICY[args.hostVisType] !== "transform") {
    return args.hostSpec;
  }

  const transform = SEMANTIC_TRANSFORM_BY_HOST[args.hostVisType];
  return transform ? transform(args) : args.hostSpec;
}

function applySemanticPressureAdditive(args: OverlayApplyArgs): RenderSpec {
  if (OVERLAY_RENDER_POLICY[args.hostVisType] !== "additive") {
    return args.hostSpec;
  }
  if (args.overlayData.kind !== "semantic_pressure_overlay") return args.hostSpec;
  return composeSpec(
    args.hostSpec,
    buildSemanticPressureOverlayLayers(args.overlayData, args.cfg),
  );
}

const OVERLAY_ADDITIVE_APPLIERS: Record<string, (args: OverlayApplyArgs) => RenderSpec> = {
  semantic_pressure_overlay: applySemanticPressureAdditive,
};

const OVERLAY_TRANSFORMS: Record<string, (args: OverlayApplyArgs) => RenderSpec> = {
  semantic_pressure_overlay: applySemanticPressureTransform,
};

const OVERLAY_HOST_POLICIES: Record<string, OverlayHostPolicyMap> = {
  semantic_pressure_overlay: {
    __default: { mode: "annotation" },
    fracture_map: { mode: "transform", transformId: "semantic_pressure_overlay" },
    line_length_contour: { mode: "transform", transformId: "semantic_pressure_overlay" },
    momentum_profile: { mode: "transform", transformId: "semantic_pressure_overlay" },
    punctuation_pressure_strip: { mode: "additive" },
    stanza_architecture: { mode: "segmentation" },
  },
};

function applyOverlayWithPolicy(args: OverlayApplyArgs): RenderSpec {
  const hostPolicies = OVERLAY_HOST_POLICIES[args.overlayType];
  const policy = hostPolicies?.[args.hostVisType] ?? hostPolicies?.__default;
  if (!policy) return args.hostSpec;

  if (policy.mode === "additive") {
    const additiveApplier = OVERLAY_ADDITIVE_APPLIERS[args.overlayType];
    return additiveApplier ? additiveApplier(args) : args.hostSpec;
  }

  if (policy.mode === "transform") {
    if (!policy.transformId) return args.hostSpec;
    const transform = OVERLAY_TRANSFORMS[policy.transformId];
    return transform ? transform(args) : args.hostSpec;
  }

  // annotation and segmentation are intentionally no-op until a concrete
  // overlay type is mapped for those modes.
  return args.hostSpec;
}

export function applyOverlay(args: OverlayApplyArgs): RenderSpec {
  return applyOverlayWithPolicy(args);
}

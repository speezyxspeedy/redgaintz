export interface Dataset {
  dataset_id: string;
  name: string;
  provider: string;
  version: string;
  variable: string;
  variable_long?: string;
  units: string;
  units_note?: string;
  temporal_resolution: string;
  spatial_resolution: string;
  coverage_start: string;
  coverage_end?: string;
  access?: string;
  source_url?: string;
  reference_url?: string;
  verified: boolean;
  disabled_reason?: string;
  note?: string;
  supports?: string[];
  concept_id?: string;
}

export interface RegionPreset {
  id: string;
  name: string;
  center: [number, number];
  height_m: number;
}

export interface District {
  region_id: string;
  name: string;
  division: string;
}

export interface Region {
  region_id: string;
  name: string;
  parent: string;
  level: string;
  boundary_file: string;
  display_file: string;
  districts: District[];
  presets: RegionPreset[];
}

export interface Registries {
  datasets: { supported_dataset_id: string; datasets: Dataset[] };
  regions: {
    boundary_version: string;
    default_region_id: string;
    regions: Region[];
    district_analysis_note: string;
  };
}

export interface Observation {
  time: number;
  value: number | null;
  valid_fraction: number;
  cell_count: number;
}

export interface TrendResult {
  status?: string;
  direction?: string;
  p_value?: number;
  significant?: boolean;
  sen_slope?: number;
  sen_slope_ci95?: [number, number];
  ols_slope?: number;
  lag1_autocorrelation?: number | null;
  lag1_autocorrelation_threshold?: number;
  lag1_autocorrelation_flag?: boolean;
  total_change?: number;
  percent_change_of_mean?: number | null;
  sample_count?: number;
  required_observations?: number;
  message?: string;
  interpretation?: string;
}

export interface AnalysisResult {
  run_id: string;
  region_id: string;
  boundary_version: string;
  dataset_id: string;
  dataset_version: string;
  variable: string;
  units: string;
  aggregation: "annual_total" | "jjas_total";
  observations: Observation[];
  trend: TrendResult | null;
  findings?: string;
  provenance: {
    run_id: string;
    dataset_id: string;
    dataset_version: string;
    access_date: string;
    data_origin: "live" | "cached";
    raw_sha256: string;
    raw_sha256_algorithm: string;
    raw_sources: Array<{
      file: string;
      sidecar: string;
      sha256: string;
      request_params: Record<string, string | number>;
      accessed_at: string;
    }>;
    code_git_sha: string | null;
    request_params: Record<string, string>;
    [key: string]: unknown;
  };
  limitations: string[];
  attribution: string[];
}

export interface RunIndex {
  runs: Array<{
    run_id: string;
    result: string;
    region_id: string;
    boundary_version: string;
    dataset_id: string;
    access_date: string;
    data_origin: "live" | "cached";
    start: string;
    end: string;
    aggregation: "annual_total" | "jjas_total";
  }>;
}

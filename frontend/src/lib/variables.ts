import catalogue from "../config/variables.json";
import type { AggregationRule, ViewSpec } from "./sciTypes";

export interface VariableCard {
  id: string;
  short_name: string;
  power_long_name: string;
  category: string;
  definition: string;
  why_it_matters: string;
  caveat: string;
  units_monthly: string;
  /** Units after aggregation (rainfall: mm/day becomes mm). */
  units_aggregated: string;
  aggregation_rule: AggregationRule;
  suggested_view: ViewSpec;
  /** true = name and units confirmed in a real POWER response; false = to be confirmed on fetch. */
  verified?: boolean;
}

export const VARIABLES: VariableCard[] = (catalogue.variables as unknown as VariableCard[]).map((v) => ({ ...v }));

export function getVariable(id: string): VariableCard {
  const found = VARIABLES.find((v) => v.id === id);
  if (!found) throw new Error(`Unknown variable: ${id}`);
  return found;
}

/** Map of variable id to aggregation rule, as power.ts expects. */
export function rulesFor(ids: string[]): Record<string, AggregationRule> {
  const rules: Record<string, AggregationRule> = {};
  for (const id of ids) rules[id] = getVariable(id).aggregation_rule;
  return rules;
}

/** Display units for the monthly view of a variable. In anomaly view the unit is the monthly unit. */
export function unitsFor(card: VariableCard, view: ViewSpec): string {
  return view.kind === "anomaly" ? card.units_monthly : card.units_aggregated;
}

/** POWER reports "C" and "kW-hr/m^2/day"; show friendlier symbols without changing any number. */
export function prettyUnits(units: string): string {
  if (units === "C") return "°C";
  if (units === "kW-hr/m^2/day") return "kWh/m²/day";
  return units;
}

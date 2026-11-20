/**
 * The "history window" dropdown in the search bar of every list view.
 */

import { List } from "@raycast/api";
import { TimeRange } from "../data/types";

interface RangeOption {
  value: TimeRange;
  title: string;
}

const RANGE_OPTIONS: RangeOption[] = [
  { value: "5m", title: "Last 5 Minutes" },
  { value: "15m", title: "Last 15 Minutes" },
  { value: "30m", title: "Last 30 Minutes" },
  { value: "1h", title: "Last 1 Hour" },
];

interface RangeDropdownProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function RangeDropdown(props: RangeDropdownProps) {
  return (
    <List.Dropdown
      tooltip="History Window"
      value={props.value}
      onChange={(newValue) => props.onChange(newValue as TimeRange)}
    >
      {RANGE_OPTIONS.map((option) => (
        <List.Dropdown.Item key={option.value} title={option.title} value={option.value} />
      ))}
    </List.Dropdown>
  );
}

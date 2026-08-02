/** Curated list of common IANA timezones for the org settings picker, grouped by region. Not
 *  exhaustive (the full IANA list is ~600 zones) — good enough for a native `<select>`. */
export const TIMEZONE_GROUPS: { label: string; zones: { value: string; label: string }[] }[] = [
  {
    label: "Asia",
    zones: [
      { value: "Asia/Karachi", label: "Karachi (PKT, UTC+5)" },
      { value: "Asia/Kolkata", label: "Kolkata (IST, UTC+5:30)" },
      { value: "Asia/Dhaka", label: "Dhaka (UTC+6)" },
      { value: "Asia/Kabul", label: "Kabul (UTC+4:30)" },
      { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
      { value: "Asia/Riyadh", label: "Riyadh (UTC+3)" },
      { value: "Asia/Tehran", label: "Tehran (UTC+3:30)" },
      { value: "Asia/Istanbul", label: "Istanbul (UTC+3)" },
      { value: "Asia/Jakarta", label: "Jakarta (UTC+7)" },
      { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
      { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
      { value: "Asia/Hong_Kong", label: "Hong Kong (UTC+8)" },
      { value: "Asia/Shanghai", label: "Shanghai (UTC+8)" },
      { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
      { value: "Asia/Seoul", label: "Seoul (UTC+9)" },
    ],
  },
  {
    label: "Europe",
    zones: [
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Dublin", label: "Dublin (GMT/IST)" },
      { value: "Europe/Lisbon", label: "Lisbon (WET/WEST)" },
      { value: "Europe/Paris", label: "Paris (CET/CEST)" },
      { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
      { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
      { value: "Europe/Rome", label: "Rome (CET/CEST)" },
      { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)" },
      { value: "Europe/Athens", label: "Athens (EET/EEST)" },
      { value: "Europe/Moscow", label: "Moscow (UTC+3)" },
    ],
  },
  {
    label: "Africa",
    zones: [
      { value: "Africa/Cairo", label: "Cairo (UTC+2)" },
      { value: "Africa/Lagos", label: "Lagos (UTC+1)" },
      { value: "Africa/Johannesburg", label: "Johannesburg (UTC+2)" },
      { value: "Africa/Nairobi", label: "Nairobi (UTC+3)" },
    ],
  },
  {
    label: "Americas",
    zones: [
      { value: "America/New_York", label: "New York (ET)" },
      { value: "America/Chicago", label: "Chicago (CT)" },
      { value: "America/Denver", label: "Denver (MT)" },
      { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
      { value: "America/Toronto", label: "Toronto (ET)" },
      { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
      { value: "America/Mexico_City", label: "Mexico City (CT)" },
    ],
  },
  {
    label: "Oceania",
    zones: [
      { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
      { value: "Australia/Perth", label: "Perth (AWST)" },
      { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
    ],
  },
  {
    label: "UTC",
    zones: [{ value: "UTC", label: "UTC" }],
  },
];

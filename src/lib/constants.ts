export const AGENCY = "Mines and Geosciences Bureau Region III";
export const ENTITY_NAME = "Mines and Geosciences Bureau, Regional Office No. 3";
export const ADDRESS = "DMGC Brgy. Maimpis San Fernando, Pampanga";
export const RCC_CODE = "10-003-03-00003";
export const DEPOSITORY_BANK = "LBP West San Fernando Pampanga Branch";

export const MODES = ["Cash", "Check", "Money Order"] as const;
export type Mode = (typeof MODES)[number];

/** Funds as they appear on the receipts. Cluster labels are only known for Fund 101. */
export const FUNDS = [
  { code: "101", name: "Fund 101", clusterLabel: "01 101 101", sort: 1 },
  { code: "151", name: "Fund 151", clusterLabel: null, sort: 2 },
  { code: "338", name: "Fund 338", clusterLabel: null, sort: 3 },
  { code: "TF", name: "Trust Fund", clusterLabel: null, sort: 4 },
] as const;

/** Division codes printed on the RCD. MTSS numbers are controlled by the division and stay blank. */
export const DIVISIONS = [
  { code: "MTES", rccCode: "03", sort: 1, noOpNumber: false },
  { code: "GD", rccCode: "04", sort: 2, noOpNumber: false },
  { code: "MSESDD", rccCode: "05", sort: 3, noOpNumber: false },
  { code: "FAD", rccCode: "02", sort: 4, noOpNumber: false },
  { code: "MTSS", rccCode: null, sort: 5, noOpNumber: true },
] as const;

/**
 * The six account-code columns of the RCD, and which natures of collection feed each one.
 * Placement is inferred from the October 2026 RCD workbook.
 */
export const ACCOUNT_GROUPS = [
  {
    code: "4020101000",
    name: "Permit fees",
    natures: [
      "APPLICATION FEE", "ASSIGNMENT FEE", "CLEARANCE FEE", "EVALUATION FEE", "FILING FEE",
      "PROCESSING FEE", "PROTEST / ADVERSE CLAIM", "REGISTRATION FEE", "RENEWAL FEE", "TRANSFER FEE",
    ],
  },
  {
    code: "4020107000",
    name: "Supervision & Regulation Enforcement fee",
    natures: [
      "COE / CEMCRR", "EGGAR REVIEW", "GEOHAZARD IDENTIFICATION", "GEOLOGICAL SITE SCOPING",
      "GEOLOGICAL VERIFICATION", "GEOLOGICAL VERIFICATION REPORT", "GEOLOGICAL INVESTIGATION",
      "GEOLOGICAL ASSESSMENT REPORT", "INSPECTION FEE", "VERIFICATION FEE", "VALIDATION FEE", "FINES AND PENALTIES",
    ],
  },
  {
    code: "4060999000",
    name: "Miscellaneous Income",
    natures: [
      "CERTIFICATION FEE", "CERTIFIED TRUE COPY", "CERTIFIED PHOTO COPIES", "PRINTING OF TENEMENT MAPS",
      "SALE OF UNSERVICEABLE", "GEOHAZARD CERTIFICATION",
    ],
  },
  { code: "4040101000", name: "Share from National Wealth", natures: ["ROYALTY FEE"] },
  { code: "4020199000", name: "Other Services Income", natures: ["MEGASCOPIC ANALYSIS", "ORE SAMPLE CERTIFICATE"] },
  { code: "1990104000", name: "Refund / Others", natures: ["REFUND OF EXCESS CASH ADVANCE", "INCIDENTAL EXPENSES"] },
] as const;

/** Where a nature that is in no list is reported until someone assigns it. */
export const DEFAULT_GROUP_CODE = "4060999000";

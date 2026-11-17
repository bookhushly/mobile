// How much dimmed photo shows above a form sheet, below the status bar: a sliver that says
// "this sits over Welcome", not a picture to look at.
export const SHEET_GAP_PT = 12;

/** Where a form sheet's top edge rests. */
export function sheetTop(topInset: number): number {
  return topInset + SHEET_GAP_PT;
}

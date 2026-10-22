/**
 * The switch for the Browse redesign. While false, "/" keeps the old Browse screen
 * (src/components/commute/BrowseScreen.tsx, untouched) and the sheet lives only at
 * /browse-preview. Switching "/" later means rendering <BrowseSheetScreen /> where
 * index.tsx renders <BrowseScreen /> when this is true; flipping it back to false
 * is the whole revert. Nothing reads it yet.
 */
export const BROWSE_SHEET_AT_HOME = false;

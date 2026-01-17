export const Z_INDEX = {
  // Board overlays (search, chat, menus) should sit above the canvas,
  // but below true modals.
  omniSearch: 2000,

  // App modals MUST be above all board overlays (OmniSearch, menus, etc).
  // Keep this comfortably higher to avoid future collisions.
  modal: 3000,
} as const


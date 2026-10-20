/**
 * Contract for the host-provided settings-plugins runtime package.
 *
 * This package is NOT an npm dependency: the harness client provides it
 * at bundle time through the `dsh.client.inject` declaration in
 * package.json (`"inject": ["@deepseek-ai/dsh-client-ui-settings-plugins"]`).
 * The declaration below is the registration surface the client layer
 * compiles against; the harness owns the implementation.
 */
declare module '@deepseek-ai/dsh-client-ui-settings-plugins' {
  /** One editable field on the plugin's settings card. */
  export interface SettingsFieldDescriptor {
    /** Plugin config key this field edits (mirrors the server Config). */
    key: string
    label: string
    kind: 'text' | 'select'
    defaultValue?: string
    options?: readonly string[]
    help?: string
  }

  /** Everything the settings UI needs to render one plugin's card. */
  export interface SettingsPluginDescriptor {
    /** Settings namespace (matches the server plugin's SETTINGS_NS). */
    id: string
    title: string
    description: string
    /** Visual identity: surface, ink, and the single accent color. */
    brand: { surface: string; ink: string; accent: string }
    fields: readonly SettingsFieldDescriptor[]
    /** The account card rendered above the fields (sign-in state). */
    accountCard: {
      kind: 'account'
      /** CLI/command the surface offers for interactive sign-in. */
      signInCommand: string
      /** Where users review per-app caps and plan usage. */
      manageUsageUrl: string
    }
  }

  /** Register one plugin's settings card with the harness settings UI. */
  export function registerSettingsPlugin(descriptor: SettingsPluginDescriptor): void
}

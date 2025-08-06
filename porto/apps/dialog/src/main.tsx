import { Env, Theme } from '@porto/apps'
import * as Sentry from '@sentry/react'
import { Events } from 'porto/remote'
import { Actions } from 'porto/wagmi'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getConnectors } from 'wagmi/actions'

import * as Dialog from '~/lib/Dialog.ts'
import { porto } from '~/lib/Porto.js'
import * as Router from '~/lib/Router.ts'
import * as Wagmi from '~/lib/Wagmi.ts'
import { App } from './App.js'
import './styles.css'

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'https://457697aad11614a3f667c8e61f6b9e20@o4509056062849024.ingest.us.sentry.io/4509080285741056',
    environment: Env.get(),
    integrations: [
      Sentry.replayIntegration(),
      Sentry.tanstackRouterBrowserTracingIntegration(Router.router),
    ],
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  })
}

const offInitialized = Events.onInitialized(porto, (payload, event) => {
  const { mode, referrer, theme } = payload

  Dialog.store.setState({
    mode,
    referrer: {
      ...referrer,
      origin: event.origin,
      // If there is no referrer, it is likely the user is using Porto in
      // an incognito window.
      //
      // Note: It could be tempting to pass `window.location.href` from the
      // parent window via `postMessage` as a workaround, but that could easily
      // be tampered with (ie. malicious websites could pass a different URL to
      // the dialog).
      url: document.referrer ? new URL(document.referrer) : undefined,
    },

    // Only update `customTheme` if a theme is passed. This prevents overwriting
    // the current theme with initialization messages happening after the
    // initial load (e.g. in the open() method of dialog variants).
    ...(theme
      ? { customTheme: Theme.parseJsonTheme(JSON.stringify(theme)) }
      : {}),
  })
})

const offDialogRequest = Events.onDialogRequest(
  porto,
  ({ account, request, requireUpdatedAccount }) => {
    const connectedAccount = porto._internal.store.getState().accounts[0]
    const needsSync = account && account.address !== connectedAccount?.address

    // Clear errors when the request is null (i.e. when the dialog is closed).
    if (!request) Dialog.store.setState({ error: null })

    if (needsSync)
      Actions.connect(Wagmi.config, {
        connector: getConnectors(Wagmi.config)[0]!,
        force: true,
        selectAccount: account,
      })

    Router.router.navigate({
      search: (search) => {
        return {
          ...search,
          _decoded: undefined,
          ...request,
          account,
          requireUpdatedAccount,
        } as never
      },
      to: '/dialog/' + (request?.method ?? ''),
    })
  },
)

porto.messenger.on('success', (payload) => {
  Router.router.navigate({
    search: (search) => ({ ...search, ...payload }) as never,
    to: '/dialog/success',
  })
})

porto.messenger.on('__internal', (payload) => {
  if (
    payload.type === 'resize' &&
    payload.width !== undefined &&
    Dialog.store.getState().mode === 'iframe'
  )
    Dialog.store.setState((state) =>
      payload.width === undefined
        ? state
        : {
            ...state,
            display: payload.width > 460 ? 'floating' : 'drawer',
          },
    )

  if (payload.type === 'set-theme' && payload.theme)
    Dialog.store.setState({
      customTheme: Theme.parseJsonTheme(JSON.stringify(payload.theme)),
    })
})

porto.ready()

const rootElement = document.querySelector('div#root')

if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement, {
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn('Uncaught error', error, errorInfo.componentStack)
  }),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.hot)
  import.meta.hot.on('vite:beforeUpdate', () => {
    offInitialized()
    offDialogRequest()
  })

document.addEventListener('keydown', (event) => {
  // ⌥ + 1: light/dark mode
  if (event.altKey && event.code === 'Digit1') {
    if (document.documentElement.classList.contains('scheme-light-dark')) {
      document.documentElement.classList.replace(
        'scheme-light-dark',
        'scheme-dark',
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '__porto_theme',
          newValue: 'light',
          storageArea: window.localStorage,
        }),
      )
    }
    if (document.documentElement.classList.contains('scheme-light')) {
      document.documentElement.classList.replace(
        'scheme-light',
        'scheme-light-dark',
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '__porto_theme',
          newValue: 'dark',
          storageArea: window.localStorage,
        }),
      )
    } else if (document.documentElement.classList.contains('scheme-dark')) {
      document.documentElement.classList.replace('scheme-dark', 'scheme-light')
    } else {
      let themePreference = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      themePreference = themePreference === 'dark' ? 'light' : 'dark'
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '__porto_theme',
          newValue: themePreference,
          storageArea: window.localStorage,
        }),
      )

      document.documentElement.classList.remove('scheme-light-dark')
      document.documentElement.classList.add('scheme-light')
    }
  }

  // ⌥ + 2: toggle dialog mode
  if (event.altKey && event.code === 'Digit2') {
    document.documentElement.toggleAttribute('data-dialog')
  }

  // ⌥ + h: hide dev tools
  if (event.altKey && event.code === 'KeyH') {
    const devToolsElement = document.querySelector(
      'button[aria-label="Open TanStack Router Devtools"]',
    )
    if (devToolsElement) devToolsElement.hidden = !devToolsElement.hidden

    const devTools = document.querySelector('div[data-item="dev-tools"]')
    if (devTools) devTools.hidden = !devTools.hidden
  }
})

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number
  }
}

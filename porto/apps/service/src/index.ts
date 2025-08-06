import type { ExportedHandler } from '@cloudflare/workers-types'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { trimTrailingSlash } from 'hono/trailing-slash'

import { corsApp } from './routes/cors.ts'
import { faucetApp } from './routes/faucet.ts'
import { onrampApp } from './routes/onramp.ts'
import { snapshotApp } from './routes/snapshot.tsx'
import { verifyApp } from './routes/verify.ts'

const app = new Hono<{ Bindings: Cloudflare.Env }>()
app.use(cors())
app.use(csrf())
app.use(logger())
app.use(prettyJSON())
app.use(secureHeaders())
app.use('*', requestId())
app.use(trimTrailingSlash())

app.get('/', (context) =>
  context.json({
    routes: ['/cors', '/faucet', '/onramp', '/verify', '/snapshot'],
    version: context.env.WORKERS_CI_COMMIT_SHA ?? 'running locally',
  }),
)

app.get('/health', (context) => context.text('ok'))

app.route('/cors', corsApp)
app.route('/faucet', faucetApp)
app.route('/onramp', onrampApp)
app.route('/verify', verifyApp)
app.route('/snapshot', snapshotApp)

export default app satisfies ExportedHandler<Cloudflare.Env>

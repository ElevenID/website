import { publicEntryHref } from '../../application/routing/publicEntry';
import { Box, Typography, Paper, Grid, Button, Divider, Chip } from '@mui/material';
import { SEOHead } from '../seo';
import { breadcrumbListSchema, protocolSchema } from '../seo/structuredData';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { CORE_PRIMITIVES } from '../../data/agentProtocolContent';
import ProtocolStatusNote from '../protocol/ProtocolStatusNote';

function WhatIsMartyProtocolPage() {
  return (
    <Box>
      <SEOHead
        title="What Is the Marty Identity Protocol? — People and Agents"
        description="Marty's five core primitives organize digital identity workflows. Learn how optional agent-trust and delegation contracts add scoped authority, explicit approval, and decision evidence."
        canonicalPath="/what-is-marty-protocol"
        keywords={['Marty Identity Protocol', 'MIP', 'identity protocol', 'agent identity', 'delegation grant', 'trust framework', 'verifiable credentials']}
        structuredData={[
          protocolSchema(),
          breadcrumbListSchema([
            { name: 'Home', url: 'https://elevenidllc.com' },
            { name: 'What Is the Marty Identity Protocol?', url: 'https://elevenidllc.com/what-is-marty-protocol' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'DefinedTerm',
            name: 'Marty Identity Protocol',
            description: 'An open draft specification with five core primitives for digital identity workflows and optional source contracts for agent trust and delegated authority.',
          },
        ]}
      />

      <Box sx={{
        textAlign: 'center', py: 6, px: { xs: 2, md: 4 }, mb: 6,
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
        color: 'white', borderRadius: 2,
      }}>
        <AccountTreeIcon sx={{ fontSize: 56, mb: 2, opacity: 0.9 }} />
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold', fontSize: { xs: '2rem', md: '3rem' } }}>
          What Is the Marty Identity Protocol?
        </Typography>
        <Typography variant="h6" component="p" sx={{ maxWidth: 800, mx: 'auto', opacity: 0.95 }}>
          A shared model for identity workflows, with explicit trust, policy, and evidence
          for people, managed machines, and agents acting on their behalf.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, mb: 4, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>A common language for identity</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          The <strong>Marty Identity Protocol (MIP)</strong> is an open draft specification
          for the building blocks that make digital identity workflows repeatable. It connects
          credential formats and exchange protocols to operational choices: which issuers to trust,
          what to issue or verify, which rules apply, and where the workflow runs.
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Newer optional source contracts extend that model to agents: identifying the actor,
          binding it to a key and runtime, establishing whom it may represent, and retaining
          evidence of the resulting identity-policy decision.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label="Open draft specification" color="primary" variant="outlined" />
          <Chip label="Apache 2.0" variant="outlined" />
          <Chip label="Five core primitives" variant="outlined" />
        </Box>
      </Paper>

      <Box sx={{ mb: 5 }}><ProtocolStatusNote /></Box>

      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        The five core primitives
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CORE_PRIMITIVES.map((primitive) => (
          <Grid size={{ xs: 12, sm: 6 }} key={primitive.name}>
            <Paper elevation={0} sx={{ p: 2.5, height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>{primitive.name}</Typography>
              <Typography variant="body1" color="text.secondary">{primitive.description}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
        Supporting abstractions give those primitives more detail. Compliance Profiles map
        credential requirements; Machine Identities describe managed infrastructure; decision
        receipts retain identity-bound results. The optional <strong>DelegationGrant</strong>
        {' '}adds scoped representation. None adds a sixth core primitive.
      </Typography>

      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, mb: 5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          What changes when an agent acts for someone?
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Authentication identifies the actor. Delegated authority establishes whether that
          actor may represent a particular person or organization for the proposed action.
          Marty’s optional grant contract records the issuer, grantor, represented subject,
          delegate, permitted scope, proof binding, and expiry.
        </Typography>
        <Box component="ul" sx={{ pl: 3, my: 0, '& li': { mb: 1.5 } }}>
          <Typography component="li" variant="body1"><strong>Approval is explicit.</strong> The grantor confirms the exact immutable terms through a trusted mechanism. Sign-in alone does not establish consent.</Typography>
          <Typography component="li" variant="body1"><strong>Authority is current.</strong> Only active grants may authorize; the selected online profile checks status, proof, scope, and freshness again at final use.</Typography>
          <Typography component="li" variant="body1"><strong>Evidence is bound to the request.</strong> The signed decision identifies the actor, represented subject, grant revision, operation, audience, policy, and lifetime.</Typography>
          <Typography component="li" variant="body1"><strong>Recovery preserves the original outcome.</strong> An authorized historical read does not renew the grant or repeat the application’s operation.</Typography>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, mb: 5, bgcolor: '#f3f7fd', borderRadius: 2 }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Example: a purchasing assistant with a specific mandate
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          A customer explicitly approves an agent to act within a defined scope. At use, the
          identity system checks the agent’s proof, the represented customer, the current grant,
          and the exact operation. The commerce application independently checks the approved
          operation, price, stock, spending reservations, and payment authorization before any purchase.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Marty supplies identity, authority, and decision evidence. The application owns
          the agent’s prompts and tasks, its business permissions, and the purchase outcome.
          The same identity model can support delegated credential administration without
          turning identity Flows into a commerce or agent execution engine.
        </Typography>
      </Paper>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        The initial delegation profile is single-hop and online. Offline grants, further
        delegation, wallet transaction signing, and payment authorization are outside its
        scope. Integration and availability depend on the selected implementation and its
        deployment qualification.
      </Typography>

      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 4 }}>
        <Button variant="contained" size="large" href={publicEntryHref('/protocol')}>
          Explore the protocol and delegation model
        </Button>
        <Button variant="outlined" size="large" href={publicEntryHref('/ai')}>
          Agent identity and integration
        </Button>
        <Button variant="text" size="large" href={publicEntryHref('/blog/introducing-mip')}>
          Read the MIP introduction
        </Button>
      </Box>
    </Box>
  );
}

export default WhatIsMartyProtocolPage;

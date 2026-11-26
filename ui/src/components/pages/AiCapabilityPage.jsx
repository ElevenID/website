import { publicEntryHref } from '../../application/routing/publicEntry';
import {
  Box, Typography, Paper, Grid, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import { SEOHead } from '../seo';
import { softwareApplicationSchema, breadcrumbListSchema } from '../seo/structuredData';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VerifiedIcon from '@mui/icons-material/Verified';
import SecurityIcon from '@mui/icons-material/Security';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import PolicyIcon from '@mui/icons-material/Policy';

import ProtocolSupportCatalog from './MarketingProtocolSupportCatalog';

const identityLayers = [
  {
    name: 'Acting principal',
    question: 'Who is making the request?',
    explanation: 'An AgentPrincipal identifies an accountable service account, managed machine, or external principal. Its organization and identity source remain explicit.',
  },
  {
    name: 'Runtime and proof key',
    question: 'Which instance is acting, and can it prove key control?',
    explanation: 'Bind the principal to the selected runtime instance and public key. A model name, agent description, or runtime label does not establish that binding.',
  },
  {
    name: 'Represented subject',
    question: 'For whom is the agent acting?',
    explanation: 'Keep the person or organization being represented separate from the acting principal. Shared runtimes need independently established subject-session evidence under a qualified profile.',
  },
  {
    name: 'Delegated authority',
    question: 'What may it request, where, and until when?',
    explanation: 'A DelegationGrant records approved actions, resources, audiences, validity and the selected key or session binding. Identity and authority are checked separately.',
  },
];

const managementCapabilities = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 32 }} />,
    title: 'Maintain an attributable directory',
    description: 'Register organization-scoped identities, their accountable owner, identity source, runtime reference and public key. Preserve revision history and the administrator responsible for each change.',
  },
  {
    icon: <VerifiedIcon sx={{ fontSize: 32 }} />,
    title: 'Enroll a managed key',
    description: 'A managed entry starts provisioned. Its key custodian signs a retained challenge to establish key control. Enrollment makes the identity eligible for subsequent checks; machine trust and operation authority are evaluated at use time.',
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 32 }} />,
    title: 'Control keys and identity status',
    description: 'Replace keys and suspend, revoke or retire identities while retaining their history. A new key needs new enrollment where required. Existing key-bound grants keep their original terms; changing that binding requires a new grant and approval.',
  },
  {
    icon: <PolicyIcon sx={{ fontSize: 32 }} />,
    title: 'Review and withdraw authority',
    description: 'Show the exact organization, delegate, scope, audience, validity and binding before explicit consent. Grant suspension, reinstatement and revocation have their own lifecycle. Consent withdrawal and current organization permissions remain part of authority checks.',
  },
];

const delegationSteps = [
  {
    title: 'Approve the exact terms',
    description: 'Create an immutable, scoped grant and obtain explicit approval from the authorized human. Bind the delegate, represented subject, permitted operation and validity. Current v1 grants are single-hop: they do not permit further delegation.',
  },
  {
    title: 'Start one use',
    command: 'START_USE',
    description: 'Retain the original command identity and operation digest before sending. The selected online service checks admission and retains a challenge for the exact grant and operation.',
  },
  {
    title: 'Prove identity and evaluate current authority',
    command: 'FINALIZE_USE',
    description: 'Verify the signed request and return its challenge-bound proof. Finalization checks the machine proof, current identity and credential status, consent, grant, access and policy before retaining a PERMIT or DENY decision.',
  },
  {
    title: 'Verify the decision evidence',
    description: 'Check the signed receipt against independently trusted keys and the original operation context. The receipt records an identity and authority decision. Your application applies its own business rules, budget, reservation and execution controls.',
  },
  {
    title: 'Recover the original result',
    command: 'RECOVER_RESULT',
    description: 'After a lost response, use the retained command identity and digest to recover its original result. Recovery preserves the original receipt and timestamps. An uncertain or missing result is not permission to issue a replacement operation.',
  },
];

const ownership = [
  {
    owner: 'Marty / ElevenID',
    responsibilities: 'Identity inventory and bindings, credential and trust checks, consent, delegated authority, decision evidence, and recovery of its own committed results.',
  },
  {
    owner: 'Your application and agent runtime',
    responsibilities: 'Agent definitions, prompts and models, task orchestration, business permissions, budgets, reservations, provider calls, duplicate-operation prevention and business outcomes.',
  },
  {
    owner: 'Your identity provider',
    responsibilities: 'User sign-in and session authentication. A successful login establishes the signed-in user; delegated approval and agent authority still require their own checks.',
  },
];

function AiCapabilityPage() {
  return (
    <Box>
      <SEOHead
        title="Agent Identity & Delegation — ElevenID"
        description="Learn how Marty connects agent identity, runtime and key bindings, explicit delegated authority, online use checks, signed evidence and original-result recovery."
        canonicalPath="/ai"
        keywords={['agent identity', 'agent delegation', 'DelegationGrant', 'agent management', 'machine credentials', 'delegated authority']}
        structuredData={[
          softwareApplicationSchema({
            name: 'ElevenID Agent Identity and Delegation',
            description: 'Profile-specific agent identity, delegated authority and trust evidence with explicit application and deployment boundaries.',
            applicationCategory: 'SecurityApplication',
          }),
          breadcrumbListSchema([
            { name: 'Home', url: 'https://elevenidllc.com' },
            { name: 'Agent Identity & Delegation', url: 'https://elevenidllc.com/ai' },
          ]),
        ]}
      />

      <Box sx={{
        textAlign: 'center', py: { xs: 4, md: 6 }, px: { xs: 2, md: 4 }, mb: 4,
        background: 'linear-gradient(135deg, #1976d2 0%, #7c4dff 100%)',
        color: 'white', borderRadius: 2,
      }}>
        <SmartToyIcon sx={{ fontSize: 48, mb: 2, opacity: 0.9 }} />
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold', fontSize: { xs: '2rem', md: '3rem' } }}>
          Agent identity &amp; delegation
        </Typography>
        <Typography variant="h6" sx={{ maxWidth: 800, mx: 'auto', opacity: 0.95 }}>
          Know which agent is acting, whom it represents, and what it is authorized to request.
          Marty connects identity, explicit authority and verifiable evidence for each operation.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 3, mb: 6, borderColor: 'primary.main', bgcolor: 'action.hover' }}>
        <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Choose a profile, then qualify the deployment
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The implementation includes opt-in identity administration and a selected managed-machine
          path using MachineCredential, a key-bound grant and an exact operation. Administration,
          enrollment and delegated-use hosting require explicit enablement. Selected test qualification
          does not activate a production deployment or establish general wallet interoperability.
          The public MIP baseline remains 0.5.0; optional protocol profiles do not automatically change
          its advertised support.
        </Typography>
      </Paper>

      <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        Keep identity, runtime and authority distinct
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        A logical agent can run in different processes or act for different people. Make each
        relationship explicit so changing a runtime, key or represented subject cannot silently
        carry an old authorization into a new context.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 6 }}>
        <Table sx={{ minWidth: 540 }} aria-label="Agent identity and authority concepts">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Concept</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>What it establishes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {identityLayers.map((layer) => (
              <TableRow key={layer.name}>
                <TableCell component="th" scope="row" sx={{ width: '28%', verticalAlign: 'top', fontSize: '1rem' }}>
                  <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>{layer.name}</Box>
                  {layer.question}
                </TableCell>
                <TableCell sx={{ fontSize: '1rem', verticalAlign: 'top' }}>{layer.explanation}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Manage an agent&apos;s identity lifecycle
      </Typography>
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {managementCapabilities.map((capability) => (
          <Grid size={{ xs: 12, sm: 6 }} key={capability.title}>
            <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
              <Box sx={{ color: 'primary.main', mb: 1 }}>{capability.icon}</Box>
              <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>{capability.title}</Typography>
              <Typography variant="body1" color="text.secondary">{capability.description}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        From approval to one delegated use
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Consider a purchasing assistant acting for an organization. Its grant identifies the
        allowed action, supplier resource, receiving service, time window and proof key. For the
        selected exact-operation profile, changing the purchase request changes the bound operation.
      </Typography>
      <Box component="ol" sx={{ pl: 3, mb: 4, '& > li': { pl: 1, mb: 2.5 } }}>
        {delegationSteps.map((step) => (
          <Box component="li" key={step.title}>
            <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
              {step.title}
            </Typography>
            {step.command && (
              <Typography component="code" sx={{ display: 'inline-block', fontSize: '0.875rem', fontFamily: 'monospace', bgcolor: 'action.hover', px: 1, py: 0.25, mb: 1, borderRadius: 1 }}>
                {step.command}
              </Typography>
            )}
            <Typography variant="body1" color="text.secondary">{step.description}</Typography>
          </Box>
        ))}
      </Box>
      <Paper variant="outlined" sx={{ p: 3, mb: 6 }}>
        <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
          A receipt preserves evidence; current authority still matters
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Delegated decision receipts have EVIDENCE_ONLY semantics. A valid signature records the
          issuer&apos;s decision for that request; it does not prove payment or completed execution.
          Historical recovery keeps the original expiry and does not restore a revoked grant.
          Offline receipt verification cannot establish current revocation status. New use requires
          the selected online checks and the application&apos;s own authorization.
        </Typography>
        <Button component="a" href={publicEntryHref('/protocol')} sx={{ mt: 2 }}>
          Explore the delegation model
        </Button>
      </Paper>

      <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Connect trust to the application you already run
      </Typography>
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {ownership.map((entry) => (
          <Grid size={{ xs: 12, md: 4 }} key={entry.owner}>
            <Paper elevation={0} sx={{ p: 3, height: '100%', bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>{entry.owner}</Typography>
              <Typography variant="body1" color="text.secondary">{entry.responsibilities}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        Integrate against your deployment&apos;s contract
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Set MARTY_BASE_URL to your deployed Gateway origin. Read its support catalog and generated
        OpenAPI document, then select the enabled profile and its required identity, trust and
        transport configuration. Managed delegated-use callers require separately configured mutual
        TLS and current machine-use access.
      </Typography>
      <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'action.hover' }}>
        <Typography variant="subtitle1" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>Gateway discovery</Typography>
        <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', overflow: 'auto', m: 0 }}>
{`curl -fsS "$MARTY_BASE_URL/v1/protocol-support"
curl -fsS "$MARTY_BASE_URL/openapi.json"`}
        </Box>
      </Paper>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        The protocol also defines optional contracts for OAuth/account linking, AuthZEN decision
        mapping, lifecycle security signals and portable trust evidence. These are source-level
        integration profiles with runtime qualification still NOT_ASSESSED. Their schemas describe
        a shared contract; each adapter needs implementation and qualification before a deployment
        advertises support.
      </Typography>

      <Box sx={{ mb: 6 }}>
        <ProtocolSupportCatalog />
      </Box>

      <Paper sx={{
        p: 4, textAlign: 'center', mb: 4, borderRadius: 2,
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e8eaf6 100%)',
      }}>
        <IntegrationInstructionsIcon sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Build an explicit chain of identity and authority
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 650, mx: 'auto' }}>
          Start with the protocol model, choose a supported deployment profile, and integrate the
          public contract with your application&apos;s execution and recovery workflow.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" size="large" component="a" href={publicEntryHref('/docs')}>
            API documentation
          </Button>
          <Button variant="outlined" size="large" component="a" href={publicEntryHref('/protocol')}>
            Marty protocol
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default AiCapabilityPage;

import { Box, Button, Card, CardContent, Chip, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { publicEntryHref } from '../../application/routing/publicEntry';
import { AGENT_TRUST_BOUNDARIES, DELEGATION_ROLES, DELEGATION_STEPS } from '../../data/agentProtocolContent';
import ProtocolStatusNote from './ProtocolStatusNote';

export default function AgentDelegationOverview() {
  return (
    <Box component="section" aria-labelledby="agent-delegation-title" id="agent-delegation" sx={{ mb: 8 }}>
      <Box sx={{ maxWidth: 850, mx: 'auto', textAlign: 'center', mb: 4 }}>
        <Chip label="Optional protocol extensions" color="secondary" variant="outlined" sx={{ mb: 2 }} />
        <Typography id="agent-delegation-title" variant="h4" component="h2" gutterBottom sx={{ fontWeight: 800 }}>
          Identity and authority for agents
        </Typography>
        <Typography variant="body1" color="text.secondary">
          When an agent acts for a person or organization, a system needs to establish both
          the actor’s identity and its authority to represent that subject. Marty’s newer
          source contracts describe that relationship, the evidence needed at use, and the
          controls for withdrawing authority.
        </Typography>
      </Box>

      <Box sx={{ mb: 4 }}><ProtocolStatusNote /></Box>

      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
          Five core primitives, one optional grant relationship
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Trust Profiles, Credential Templates, Presentation Policies, Deployment Profiles,
          and Flows still form the core model. The optional <strong>DelegationGrant</strong>
          {' '}connects an authenticated delegate to a represented subject under explicit authority.
          It is a supporting abstraction alongside machine identities and decision evidence.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          A grant states the permitted actions, resources, audiences, validity period, proof
          binding, and any accepted domain constraints. Its approved terms are immutable.
          Changing the delegate, key, or terms requires a new grant and fresh approval.
        </Typography>
      </Paper>

      <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 700, mb: 2.5 }}>
        Keep the four roles clear
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {DELEGATION_ROLES.map((role) => (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={role.name}>
            <Card variant="outlined" sx={{ height: '100%', borderTop: '3px solid', borderTopColor: 'primary.main' }}>
              <CardContent>
                <Typography variant="h6" component="h4" gutterBottom sx={{ fontWeight: 700 }}>{role.name}</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>{role.question}</Typography>
                <Typography variant="body1" color="text.secondary">{role.description}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, mb: 4, bgcolor: '#f6f3fc', borderRadius: 2 }}>
        <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 700 }}>Example: delegated credential administration</Typography>
        <Typography variant="body1">
          An authorized university administrator approves a grant for a service agent to request
          a specific credential-administration action on behalf of the university. The grant
          authority maintains the record; the administrator is the grantor; the university is
          the represented subject; the authenticated service agent is the delegate. The
          credential application still checks its own resource permissions and performs the action.
        </Typography>
      </Paper>

      <Box component="figure" sx={{ m: 0, mb: 4 }} aria-labelledby="delegation-use-title">
        <Typography id="delegation-use-title" variant="h5" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
          From approval to a verifiable decision
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5 }}>
          This sequence explains the optional contract. Authentication, approval, an identity
          decision, and successful application execution are separate facts.
        </Typography>
        <Box component="ol" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2, listStyle: 'none', m: 0, p: 0 }}>
          {DELEGATION_STEPS.map((step, index) => (
            <Paper component="li" key={step.title} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="body2" color="primary.dark" sx={{ fontWeight: 700, mb: 1 }}>Step {index + 1}</Typography>
              <Typography variant="h6" component="h4" gutterBottom sx={{ fontWeight: 700 }}>{step.title}</Typography>
              <Typography variant="body1" color="text.secondary">{step.description}</Typography>
            </Paper>
          ))}
        </Box>
        <Typography component="figcaption" variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          A receipt records the identity-policy decision. Recovery preserves that evidence;
          it neither renews the grant nor authorizes another operation.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 2 }}>
            <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 700 }}>A grant has a current lifecycle</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              A grant begins <strong>PENDING</strong> and becomes <strong>ACTIVE</strong> only
              after trusted approval. An active grant may be <strong>SUSPENDED</strong> and
              reinstated after current approval and authority checks. <strong>REVOKED</strong>
              {' '}and <strong>EXPIRED</strong> are terminal states.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Only ACTIVE grants may authorize. Online status, evidence freshness, and the
              exact operation are checked again at final use. Stale or unavailable authority
              fails closed. Revocation blocks new authorized use within the deployment’s
              declared enforcement bounds; it cannot undo a completed external effect.
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 2 }}>
            <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 700 }}>Identity records need proof</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Agent identity administration records accountable ownership, source identity,
              runtime references, keys, and history. Managed key enrollment, operational
              authentication, and delegated authority each need their own evidence.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              A logical agent is distinct from its running instance and proof key. A shared
              runtime also needs a verified session for the represented subject. An inventory
              entry, a model name, or a successful sign-in cannot establish consent or resource permission.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
        Identity authority and application execution
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Table aria-label="Responsibilities of Marty and the consuming application">
          <TableHead sx={{ bgcolor: '#f3f7fd' }}>
            <TableRow>
              <TableCell component="th" scope="col" sx={{ fontSize: '1rem', fontWeight: 700, width: '50%' }}>Marty / ElevenID</TableCell>
              <TableCell component="th" scope="col" sx={{ fontSize: '1rem', fontWeight: 700 }}>Application / agent runtime</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {AGENT_TRUST_BOUNDARIES.map((boundary) => (
              <TableRow key={boundary.marty}>
                <TableCell sx={{ fontSize: '1rem', verticalAlign: 'top' }}>{boundary.marty}</TableCell>
                <TableCell sx={{ fontSize: '1rem', verticalAlign: 'top' }}>{boundary.application}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The initial delegated-authority profile is single-hop and online. Offline grants,
        onward delegation, wallet transaction signing, and payment authorization are outside
        this profile. Named provider or wallet compatibility requires separately qualified adapters.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" href={publicEntryHref('/ai')}>Explore agent identity and integration</Button>
        <Button variant="outlined" href={publicEntryHref('/what-is-marty-protocol')}>Review the five core primitives</Button>
      </Box>
    </Box>
  );
}

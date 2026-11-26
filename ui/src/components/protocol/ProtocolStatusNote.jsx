import { Box, Chip, Paper, Typography } from '@mui/material';
import { PUBLIC_MIP_BASELINE_VERSION } from '../../data/agentProtocolContent';

/** Shared publication boundary; deliberately separate from runtime discovery. */
export default function ProtocolStatusNote() {
  return (
    <Paper component="aside" aria-label="Protocol publication and availability" elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid', borderColor: 'primary.light', borderRadius: 2, bgcolor: '#f3f7fd' }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <Chip label={`Public MIP baseline: v${PUBLIC_MIP_BASELINE_VERSION}`} color="primary" variant="outlined" />
        <Chip label="Newer source contracts: optional drafts" variant="outlined" />
      </Box>
      <Typography variant="body1" color="text.secondary">
        The public MIP baseline shown on this site and the newer delegation and agent-trust
        source contracts have different release boundaries. These optional contracts are
        unreleased additions. Their reference coverage does not qualify a deployment:
        runtime assessment remains <Box component="span" sx={{ fontFamily: 'monospace' }}>NOT_ASSESSED</Box>,
        with public discovery disabled until the selected profiles have matching deployment evidence.
      </Typography>
    </Paper>
  );
}

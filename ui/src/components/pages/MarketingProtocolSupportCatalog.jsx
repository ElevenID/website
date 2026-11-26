import { publicEntryHref } from '../../application/routing/publicEntry';
import { Alert, Box, Typography } from '@mui/material';
import snapshot from '../../../../contracts/protocol-support-catalog.json';
import { normalizeProtocolSupportCatalog } from '../../application/protocolSupportCatalog';
import ProtocolSupportCatalogView from './ProtocolSupportCatalogView';

const catalog = normalizeProtocolSupportCatalog(snapshot);
export default function MarketingProtocolSupportCatalog() {
  return <>
    <Alert severity="info" sx={{ mb: 2 }}>
      <strong>Historical support snapshot — {catalog.catalog_revision}.</strong>{' '}
      This retained snapshot predates the latest agent identity and delegation work.
      Its support labels describe that older candidate, not the capabilities of your current deployment.
      Check your deployment's live catalog before integrating.
    </Alert>
    <Box component="details" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
      <Typography component="summary" sx={{ cursor: 'pointer', fontWeight: 700 }}>
        Review historical support snapshot
      </Typography>
      <Box sx={{ mt: 3 }}>
        <ProtocolSupportCatalogView
          catalog={catalog}
          sourcePath={publicEntryHref('/docs')}
          sourceLabel="deployment API documentation"
        />
      </Box>
    </Box>
  </>;
}

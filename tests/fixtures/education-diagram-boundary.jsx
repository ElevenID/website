// Named markers qualify page composition only; no production SVG is imported.
const diagram = (name) => function DeferredDiagram({ interactive }) {
  return <aside aria-label={`Deferred ${name}`} data-interactive={String(Boolean(interactive))} />;
};
export const TrustModelDiagram = diagram('trust model diagram');
export const IdentityTransactionDiagram = diagram('identity transaction diagram');
export const CredentialFlowDiagram = diagram('credential flow diagram');
export const StandardsStackDiagram = diagram('standards stack diagram');
export const InteractiveProtocolMap = diagram('protocol map');

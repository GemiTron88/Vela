// Project-owned adapters use real test fixtures and normal authentication.
// Do not add a production session/elevation backdoor for visual capture.
export async function prepare({page,context,cell,config,root}) {
  throw new Error('Implement real persona/session setup, fixture/state preparation, locale/theme application and navigation. Use tester-army for semantic interactions; do not invent captures of states that were not reached.');
}
export async function observe({page,cell,config,root}) {
  // Read immutable build identity and fixture seed from the running backend;
  // inspect current page/app state. Never return cell metadata as observation.
  throw new Error('Read live appIdentity, revision, persona, route, state, locale, direction, theme, fixtureSet, fixtureData and stateData.');
}

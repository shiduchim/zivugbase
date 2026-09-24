import { useLayoutEffect } from 'preact/hooks';
import { fatal, mode, restoreScroll, route } from '../state';
import { TabBar, ToastView, Loading } from './parts/common';
import { FirstRun } from './screens/FirstRun';
import { Home } from './screens/Home';
import { People } from './screens/People';
import { PersonScreen } from './screens/Person';
import { PersonEdit } from './screens/PersonEdit';
import { Settings } from './screens/Settings';
import { ImportReview } from './screens/ImportReview';
import { Inbox } from './screens/Inbox';
import { InboxItemScreen } from './screens/InboxItem';
import { Capture } from './screens/Capture';
import { MakeMatch } from './screens/MakeMatch';

export function App() {
  const r = route.value;
  const m = mode.value;
  useLayoutEffect(() => restoreScroll(r.hash), [r.hash]);

  if (fatal.value) return <div class="app"><main><p class="notice bad">{fatal.value}</p></main></div>;
  if (m === undefined) return <div class="app"><main><Loading /></main></div>;
  if (m === null || r.path[0] === 'first-run') return <div class="app"><FirstRun /><ToastView /></div>;

  const [a, b, c] = r.path;
  let screen;
  switch (a) {
    case 'people': screen = <People />; break;
    case 'person':
      if (b === 'new') screen = <PersonEdit key="new" />;
      else if (b && c === 'edit') screen = <PersonEdit key={b} id={b} />;
      else if (b) screen = <PersonScreen key={b} id={b} />;
      break;
    case 'inbox':
      if (b) screen = <InboxItemScreen key={b} id={b} />;
      else screen = <Inbox />;
      break;
    case 'capture': screen = <Capture key={b} kind={b ?? 'paste'} />; break;
    case 'settings': screen = <Settings />; break;
    case 'import': screen = <ImportReview />; break;
    case 'match': screen = <MakeMatch />; break;
  }
  if (!screen) screen = <Home />;
  /* A person's page is like PeerMatch's detail: no tabs, the note bar at the bottom instead. */
  const detail = a === 'person' && !!b && b !== 'new' && !c;
  return (
    <div class={`app${detail ? ' detail' : ''}`}>
      {screen}
      {!detail && <TabBar />}
      <ToastView />
    </div>
  );
}

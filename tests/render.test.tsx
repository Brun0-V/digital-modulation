import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { App } from '../src/App';

it('renders the app without crashing', () => {
  const html = renderToString(<App />);
  expect(html).toContain('Modulación digital');
  expect(html).toContain('Constelación I/Q');
  expect(html).toContain('Hola mundo');
});

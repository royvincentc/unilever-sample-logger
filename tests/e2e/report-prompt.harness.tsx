import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../src/index.css';
import '../../src/design/precision-lab.css';
import { ToastProvider } from '../../src/components/ui/Toast';
import Results from '../../src/pages/Results';

// Mounts the Results page alone so the report prompt can be tested without login.
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/results?tab=RawMats']}>
    <ToastProvider><Results /></ToastProvider>
  </MemoryRouter>,
);

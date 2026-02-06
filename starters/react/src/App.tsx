import routes from './router';
import { BrowserRouter as Router, useRoutes } from 'react-router-dom';
import { Suspense } from 'react';

const RoutesComponent = () => {
  return useRoutes(routes);
};

const App = () => {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <RoutesComponent />
      </Suspense>
    </Router>
  );
};

export default App;

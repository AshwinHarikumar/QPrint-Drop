/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import Receive from './pages/Receive';
import Send from './pages/Send';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Receive />} />
        <Route path="/receive" element={<Receive />} />
        <Route path="/send/:sessionId" element={<Send />} />
      </Routes>
    </BrowserRouter>
  );
}

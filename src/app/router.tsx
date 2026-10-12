import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { ReviewPage } from '@/features/review/review-page';
export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ReviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

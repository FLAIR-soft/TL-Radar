import { redirect } from 'next/navigation';

// Лендинга у TL-Organizer нет. Это внутренний инструмент за корпоративным
// входом MIDAS: до приложения доходят только сотрудники MIFCOM, и
// рассказывать им, что это за продукт, незачем. Корень ведёт сразу на борд.
export default function RootPage() {
  redirect('/dashboard');
}

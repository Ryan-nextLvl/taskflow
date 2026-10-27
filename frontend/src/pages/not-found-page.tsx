import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço acessado não existe no TaskFlow."
      action={
        <Button asChild>
          <Link to="/">Ir para o dashboard</Link>
        </Button>
      }
    />
  );
}

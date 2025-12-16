import { useState } from 'react';
import { KeyManager } from './components/KeyManager';
import { PostcardComposer } from './components/PostcardComposer';
import { PostcardOutput } from './components/PostcardOutput';
import { DecryptAssist } from './components/DecryptAssist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function App() {
  const [view, setView] = useState<'keys' | 'compose' | 'output' | 'decrypt'>('keys');

  return (
    <div className={view === 'decrypt' ? 'container-shell container-shell-wide' : 'container-shell'}>
      <section className="hero-card">
        <Badge className="kv-badge">E2EE年賀状 / MVP</Badge>
        <h1 className="text-3xl md:text-4xl">E2EE年賀状</h1>
        <p className="text-base text-muted-foreground">公開鍵の管理と、宛先ごとの暗号化をブラウザだけで行います（秘密鍵は扱いません）。</p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button variant={view === 'keys' ? 'default' : 'outline'} onClick={() => setView('keys')}>
            公開鍵管理
          </Button>
          <Button variant={view === 'compose' ? 'default' : 'outline'} onClick={() => setView('compose')}>
            暗号化作成
          </Button>
          <Button variant={view === 'output' ? 'default' : 'outline'} onClick={() => setView('output')}>
            はがき出力
          </Button>
          <Button variant={view === 'decrypt' ? 'default' : 'outline'} onClick={() => setView('decrypt')}>
            復号支援
          </Button>
        </div>
      </section>
      {view === 'keys' ? (
        <KeyManager />
      ) : view === 'compose' ? (
        <PostcardComposer />
      ) : view === 'output' ? (
        <PostcardOutput />
      ) : (
        <DecryptAssist />
      )}
    </div>
  );
}

export default App;

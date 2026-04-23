// Metis redesign canvas — main app.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accountTier":    "premium",
  "accountLayout":  "two-col",
  "accountIdentity":"hero",
  "authMode":       "login"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  return (
    <>
      <DesignCanvas>

        <DCSection id="account" title="Minha conta & Autenticação"
          subtitle="Novas telas. Tier / layout / modo de login trocáveis via Tweaks.">
          <DCArtboard id="account" label="A · /account" width={1200} height={1700}>
            <ScreenAccount tier={t.accountTier} layout={t.accountLayout} identity={t.accountIdentity}/>
          </DCArtboard>
          <DCArtboard id="auth" label="B · /auth" width={560} height={820}>
            <ScreenAuth initialMode={t.authMode}/>
          </DCArtboard>
        </DCSection>

        <DCSection id="main" title="Metis · Páginas principais"
          subtitle="Home, descoberta, análise de jogador e partida.">
          <DCArtboard id="home" label="01 · Home" width={1200} height={1400}>
            <ScreenHome/>
          </DCArtboard>
          <DCArtboard id="tierlist" label="02 · Tier List" width={1200} height={1400}>
            <ScreenTierList/>
          </DCArtboard>
          <DCArtboard id="player" label="03 · Player dashboard" width={1200} height={1600}>
            <ScreenPlayer/>
          </DCArtboard>
          <DCArtboard id="match" label="04 · Match detail" width={1260} height={2400}>
            <ScreenMatch/>
          </DCArtboard>
        </DCSection>

        <DCSection id="deep" title="Páginas de descoberta profunda"
          subtitle="Campeões e itens com estatísticas, builds, matchups.">
          <DCArtboard id="champion" label="05 · Champion page (4 tabs)" width={1200} height={1500}>
            <ScreenChampion/>
          </DCArtboard>
          <DCArtboard id="items" label="06 · Itens" width={1200} height={1600}>
            <ScreenItems/>
          </DCArtboard>
        </DCSection>

        <DCSection id="ai" title="IA Metis & Engajamento"
          subtitle="Chat, planos de assinatura, novidades.">
          <DCArtboard id="chat" label="07 · Chat Metis" width={1200} height={1100}>
            <ScreenChat/>
          </DCArtboard>
          <DCArtboard id="plans" label="08 · Planos (4 tiers)" width={1200} height={1200}>
            <ScreenPlans/>
          </DCArtboard>
          <DCArtboard id="changelog" label="09 · Changelog" width={1200} height={1300}>
            <ScreenChangelog/>
          </DCArtboard>
        </DCSection>

        <DCSection id="brand" title="Marca & Equipe">
          <DCArtboard id="team" label="10 · Equipe" width={1200} height={1000}>
            <ScreenTeam/>
          </DCArtboard>
        </DCSection>

        <DCPostIt top={20} left={20} rotate={-3} width={280}>
          <b>Metis · 12 telas + /account + /auth</b><br/>
          Clica num card pra abrir em tela cheia. ← → navega, Esc sai.<br/>
          <span style={{opacity:0.7}}>Ative Tweaks na barra superior pra alternar tier, layout da /account e modo da /auth ao vivo.</span>
        </DCPostIt>

      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="/account"/>
        <TweakRadio label="Tier" value={t.accountTier}
          options={['free','doador','premium','pro']}
          onChange={(v) => setTweak('accountTier', v)}/>
        <TweakRadio label="Layout" value={t.accountLayout}
          options={[
            { value:'two-col', label:'2 cols' },
            { value:'single',  label:'1 col' },
          ]}
          onChange={(v) => setTweak('accountLayout', v)}/>
        <TweakRadio label="Identidade" value={t.accountIdentity}
          options={[
            { value:'hero',   label:'Hero'   },
            { value:'avatar', label:'Avatar' },
          ]}
          onChange={(v) => setTweak('accountIdentity', v)}/>

        <TweakSection label="/auth"/>
        <TweakRadio label="Modo inicial" value={t.authMode}
          options={[
            { value:'login',  label:'Login'  },
            { value:'signup', label:'Signup' },
            { value:'forgot', label:'Forgot' },
          ]}
          onChange={(v) => setTweak('authMode', v)}/>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);

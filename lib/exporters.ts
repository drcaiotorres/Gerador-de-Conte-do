
export function payloadToMarkdown(payload: any): string {
  const parts: string[] = [];
  if (payload?.reels) {
    payload.reels.forEach((r: any, i: number) => {
      parts.push(`## Reels ${i+1}`);
      parts.push(`**Gancho (3s):** ${r.gancho_3s}`);
      parts.push(`**Fala principal:**`);
      if (r.fala_principal) parts.push(r.fala_principal.map((l:string)=>`- ${l}`).join("\n"));
      parts.push(`**CTA:** ${r.cta_final}`);
      if (r.legenda_curta) parts.push(`**Legenda:** ${r.legenda_curta}`);
      if (r.hashtags) parts.push(`**Hashtags:** ${r.hashtags.join(" ")}`);
      parts.push("");
    });
  }
  if (payload?.post) {
    parts.push(`## Post Estático`);
    parts.push(`**Título:** ${payload.post.titulo_curto}`);
    parts.push(payload.post.legenda);
    if (payload.post.hashtags) parts.push(`**Hashtags:** ${payload.post.hashtags.join(" ")}`);
    parts.push("");
  }
  if (payload?.carrossel) {
    parts.push(`## Carrossel`);
    const slides = payload.carrossel.slides || [];
    slides.forEach((s:any, idx:number)=>{
      if (s.titulo) {
        parts.push(`**Slide ${idx+1}: ${s.titulo}**`);
        parts.push(s.subtitulo_curto || "");
      } else if (s.topicos_curto) {
        parts.push(`**Slide ${idx+1}**`);
        parts.push(s.topicos_curto.map((t:string)=>`- ${t}`).join("\n"));
      }
    });
    parts.push(`**CTA final:** ${payload.carrossel.cta_final}`);
    parts.push(payload.carrossel.legenda || "");
    if (payload.carrossel.hashtags) parts.push(`**Hashtags:** ${payload.carrossel.hashtags.join(" ")}`);
    parts.push("");
  }
  if (payload?.live) {
    parts.push(`## Live`);
    const a = payload.live.abertura || {};
    parts.push(`**Abertura:** ${a.gancho} | ${a.contexto} | ${a.promessa}`);
    const blocos = payload.live.blocos || [];
    blocos.forEach((b:any,i:number)=>{
      parts.push(`**Bloco ${i+1}: ${b.titulo}**`);
      parts.push(b.bullets?.map((t:string)=>`- ${t}`).join("\n") || "");
      parts.push(`Exemplo: ${b.exemplo_pratico}`);
      parts.push(`Pergunta para chat: ${b.pergunta_para_chat}`);
    });
    const sp = payload.live.sessao_perguntas;
    if (sp?.perguntas_sugeridas) {
      parts.push(`**Perguntas sugeridas:**`);
      parts.push(sp.perguntas_sugeridas.map((p:string)=>`- ${p}`).join("\n"));
    }
    parts.push(`**Encerramento:** ${payload.live.encerramento?.recap} | CTA: ${payload.live.encerramento?.cta}`);
    parts.push("");
  }
  if (payload?.stories) {
    parts.push(`## Stories (7 dias)`);
    payload.stories.forEach((d:any)=>{
      parts.push(`**${d.dia.toUpperCase()}**`);
      d.itens?.forEach((it:any)=>{
        parts.push(`- (${it.tipo}) ${it.roteiro_curto} ${it.cta ? " | CTA: " + it.cta : ""}`);
      });
    });
  }
  return parts.join("\n");
}


export const ReelsSchema = {
  type: "object",
  properties: {
    reels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          gancho_3s: { type: "string" },
          fala_principal: { type: "array", items: { type: "string" } },
          cta_final: { type: "string" },
          sugestao_b_roll: { type: "array", items: { type: "string" } },
          legenda_curta: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } }
        },
        required: ["gancho_3s","fala_principal","cta_final","legenda_curta","hashtags"],
        additionalProperties: false
      },
      minItems: 3,
      maxItems: 3
    }
  },
  required: ["reels"],
  additionalProperties: false
} as const;

export const PostSchema = {
  type: "object",
  properties: {
    titulo_curto: { type: "string" },
    legenda: { type: "string" },
    sugestao_arte: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } }
  },
  required: ["titulo_curto","legenda","hashtags"],
  additionalProperties: false
} as const;

export const CarrosselSchema = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        anyOf: [
          { type: "object", properties: { titulo: {type:"string"}, subtitulo_curto: {type:"string"}}, required:["titulo","subtitulo_curto"], additionalProperties:false },
          { type: "object", properties: { topicos_curto: {type:"array", items:{type:"string"}}}, required:["topicos_curto"], additionalProperties:false }
        ]
      }
    },
    cta_final: { type: "string" },
    legenda: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    sugestao_arte: { type: "string" }
  },
  required: ["slides","cta_final","legenda","hashtags"],
  additionalProperties: false
} as const;

export const LiveSchema = {
  type: "object",
  properties: {
    abertura: { type: "object", properties: {
      gancho: {type:"string"}, contexto:{type:"string"}, promessa:{type:"string"}
    }, required:["gancho","contexto","promessa"], additionalProperties:false },
    blocos: { type: "array", items: { type: "object", properties: {
      titulo:{type:"string"}, bullets:{type:"array", items:{type:"string"}},
      exemplo_pratico:{type:"string"}, pergunta_para_chat:{type:"string"}
    }, required:["titulo","bullets","exemplo_pratico","pergunta_para_chat"], additionalProperties:false }, minItems:3, maxItems:3 },
    sessao_perguntas: { type: "object", properties: { perguntas_sugeridas: { type:"array", items:{type:"string"} }}, required:["perguntas_sugeridas"], additionalProperties:false },
    encerramento: { type: "object", properties: { recap:{type:"string"}, cta:{type:"string"}}, required:["recap","cta"], additionalProperties:false }
  },
  required: ["abertura","blocos","sessao_perguntas","encerramento"],
  additionalProperties: false
} as const;

export const StoriesSchema = {
  type: "object",
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dia: { type: "string" },
          itens: { type: "array", items: { type: "object", properties: {
            tipo: {type:"string"}, roteiro_curto:{type:"string"}, sticker_sugerido:{type:"string"}, cta:{type:"string"}
          }, required:["tipo","roteiro_curto"], additionalProperties:false } }
        },
        required: ["dia","itens"],
        additionalProperties: false
      },
      minItems: 7,
      maxItems: 7
    }
  },
  required: ["stories"],
  additionalProperties: false
} as const;

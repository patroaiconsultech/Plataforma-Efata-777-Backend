import { initNeuralWebgl } from "./neuralWebgl";

type PremiumLandingOptions = {
  root: HTMLElement;
  onPrivateAccess: () => void | Promise<void>;
  onPwaSlot?: (slot: HTMLElement | null) => void;
};

function addMediaQueryChangeListener(
  media: MediaQueryList,
  listener: (event: MediaQueryListEvent) => void,
) {
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }

  const legacy = media as MediaQueryList & {
    addListener?: (callback: (event: MediaQueryListEvent) => void) => void;
    removeListener?: (callback: (event: MediaQueryListEvent) => void) => void;
  };
  legacy.addListener?.(listener);
  return () => legacy.removeListener?.(listener);
}

function runOptionalLandingFeature(name: string, feature: () => void) {
  try {
    feature();
  } catch (error) {
    // Optional visual layers must fail-soft on mobile browsers/GPUs.
    console.warn(`PatroAI optional landing feature disabled: ${name}`, error);
  }
}

const translations: Record<string, Record<string, string>> = {
        pt: {
          "nav.cocreation": "Cocriação", "nav.ecosystem": "Ecossistema", "nav.governance": "Governança", "nav.method": "Método", "nav.contact": "Contato", "nav.careers": "Carreiras", "nav.cocreator": "Co-Criador", "nav.private": "Acesso privado", "immersive.eyebrow": "PATROAI · EXPERIÊNCIA IMERSIVA", "immersive.title": "Este é um ambiente imersivo.", "immersive.copy": "Escolha entrar com som para viver a experiência completa ou continuar sem áudio.", "immersive.sound.cta": "Entrar com som", "immersive.sound.copy": "Ativar a trilha e entrar no núcleo imersivo", "immersive.silent": "Entrar sem som", "immersive.direct": "Ir direto para a apresentação", "immersive.headphones": "Recomendamos o uso de fones de ouvido para uma experiência mais imersiva.", "lobby.eyebrow": "PATROAI · NÚCLEO IMERSIVO", "lobby.title": "Escolha por onde deseja entrar.", "lobby.copy": "Navegue pelo ecossistema enquanto a experiência sonora permanece ativa.", "lobby.node.about": "Conheça a PatroAI", "lobby.node.ecosystem": "Ecossistema", "lobby.node.governance": "Governança", "lobby.node.method": "Método", "lobby.node.careers": "Carreiras & Talentos", "lobby.node.contact": "Contato Estratégico", "lobby.node.platform": "Acessar Plataforma", "lobby.hint": "Selecione um núcleo para entrar", "lobby.dragHint": "Toque e conduza o núcleo",
          "level6.eyebrow": "Núcleo de Inteligência Artificial Imersiva", "level6.title": "Nível 6: uma inteligência que estamos cocriando.", "level6.copy": "A PatroAI pesquisa e desenvolve uma nova camada de inteligência: sistemas que conectam agentes, contexto, presença, música, interface espacial, governança e impacto humano em uma experiência viva.", "level6.status": "Fronteira em cocriação · conceito em desenvolvimento", "level6.cta": "Cocriar essa fronteira", "level6.layer.context": "Contexto", "level6.layer.agents": "Agentes", "level6.layer.presence": "Presença", "level6.layer.governance": "Governança", "level6.layer.impact": "Impacto", "hero.eyebrow": "Boutique de IA sob medida · Acesso privado", "hero.title": "Inteligência <span>tailor-made</span> para contextos que exigem mais.", "hero.copy": "A PatroAI é uma boutique de inteligência artificial: combinamos tecnologia própria, estratégia, governança e especialistas internos para desenhar soluções sob medida — da primeira hipótese à operação com valor.", "hero.primary": "Falar com um especialista", "hero.secondary": "Conhecer atuação", "hero.kpi1": "frentes integradas para estratégia, capital relacional e tecnologia.", "hero.kpi2": "por cento orientado a governança, rastreabilidade e decisão.", "hero.kpi3": "ambiente privado para relacionamento qualificado e seguro.",
          "screen.title": "Governança antes da automação.", "screen.copy": "Uma camada executiva para organizar dados, agentes, documentos, risco e decisão com trilhas claras de responsabilidade.", "screen.signal1": "Estratégia aplicada", "screen.signal2": "Teses e parcerias", "screen.signal3": "Sistemas sob medida", "screen.signal4": "Perpetuação responsável", "phone.title": "Sistemas governados de <span class=\"accent\">IA</span>", "phone.copy": "Clareza estratégica, tecnologia e governança para decisão executiva.",
          "cocreation.eyebrow": "Central de Cocriação", "cocreation.title": "Onde novos negócios, startups e tecnologias ganham forma.", "cocreation.copy": "A PatroAI conecta pessoas, repertórios, capital relacional e tecnologia própria para transformar oportunidades em negócios, produtos e ecossistemas com propósito.", "cocreation.business.title": "Novos negócios", "cocreation.business.copy": "Cocriamos teses, modelos e caminhos de validação para oportunidades que precisam sair da intenção e encontrar mercado.", "cocreation.startups.title": "Startups e produtos", "cocreation.startups.copy": "Apoiamos fundadores e equipes na construção de produtos, operações e decisões orientadas por contexto, velocidade e governança.", "cocreation.technology.title": "Novas tecnologias", "cocreation.technology.copy": "Exploramos IA, agentes, automação e interfaces imersivas para criar capacidades que não existem prontas na prateleira.", "cocreation.manifesto.title": "A boutique tailor-made é o nosso modo de entrega.", "cocreation.manifesto.copy": "A central de cocriação é o nosso campo de origem: um espaço para imaginar, estruturar, testar e lançar o próximo ciclo.", "ecosystem.eyebrow": "Ecossistema PatroAI", "ecosystem.title": "Uma boutique de inteligência para desafios que não aceitam prateleira.", "ecosystem.copy": "Unimos visão executiva, tecnologia própria, especialistas internos e engenharia aplicada para transformar desafios singulares em sistemas sob medida, com governança e capacidade de operação.", "pillars.eyebrow": "Pilares de atuação", "pillars.title": "Crescer com consciência, cocriação e impacto.", "pillars.copy": "A PatroAI conecta inteligência, pessoas e responsabilidade para transformar projetos em valor compartilhado.", "pillar.cocreation.title": "Cocriação", "pillar.cocreation.copy": "Construímos com empreendedores, especialistas, comunidades e parceiros, convertendo repertório coletivo em soluções vivas.", "pillar.esg.title": "ESG", "pillar.esg.copy": "Integramos governança, responsabilidade ambiental e valor social ao desenho das decisões, operações e tecnologias.", "pillar.impact.title": "Impacto Social", "pillar.impact.copy": "Orientamos inovação para ampliar oportunidades, fortalecer culturas e gerar prosperidade com inclusão e continuidade.",
          "unit.consultech.copy": "Planejamento, valuation, diagnóstico e apoio executivo para decisões de alto impacto.", "unit.consultech.a": "Business plan e estratégia", "unit.consultech.b": "Modelagens dinâmicas de valor", "unit.consultech.c": "Suporte executivo especializado", "unit.holding.copy": "Desenvolvimento de teses, novos negócios e parcerias com potencial de escala e sinergia.", "unit.holding.a": "Projetos por segmento", "unit.holding.b": "Conexão institucional", "unit.holding.c": "Construção de oportunidades", "unit.factory.copy": "Sistemas, automações e ambientes digitais seguros para gestão, decisão e escala operacional.", "unit.factory.a": "IA governada para empresas", "unit.factory.b": "Fluxos executivos inteligentes", "unit.factory.c": "Arquitetura sob medida",
          "governance.eyebrow": "Governança, ESG e perpetuação", "governance.title": "IA que respeita contexto, responsabilidade e continuidade.", "governance.a": "Rastreabilidade desde o desenho da solução.", "governance.b": "Decisões com critério, evidências e limites operacionais.", "governance.c": "Aplicação responsável para empresas, investidores e especialistas.", "governance.d": "Arquitetura preparada para continuidade, escala e controle.", "metric.a": "Diagnóstico estratégico antes de qualquer automação.", "metric.b": "Arquitetura de IA conectada ao negócio e ao risco.", "metric.c": "Rede qualificada para consultores, empresas e investidores.", "metric.d": "Operação privada, controlada e orientada a valor.",
          "method.eyebrow": "Método tailor-made", "method.title": "Do contexto único ao sistema que cria valor.", "method.copy": "Cada projeto começa pelo contexto real, não por um pacote pronto. Priorizamos aderência, confidencialidade e maturidade operacional antes de desenhar a arquitetura certa.", "timeline.a.title": "Triagem estratégica", "timeline.a.copy": "Entendimento do contexto, objetivo de negócio, riscos e prioridade real da organização.", "timeline.b.title": "Arquitetura de valor", "timeline.b.copy": "Modelagem da oportunidade, indicadores, governança e potencial de retorno operacional.", "timeline.c.title": "Protótipo controlado", "timeline.c.copy": "Desenho do fluxo, validação com usuários-chave e limites claros de acesso e execução.", "timeline.d.title": "Escala assistida", "timeline.d.copy": "Evolução incremental com auditoria, melhoria contínua e alinhamento executivo.",
          "legal.eyebrow": "Privacidade e termos", "legal.title": "Uso responsável, dados e governança.", "legal.copy": "Princípios de privacidade, segurança e uso responsável orientam o ambiente PatroAI e a forma como dados, agentes e decisões são tratados.", "legal.privacy.title": "Política de Privacidade", "legal.privacy.copy": "Os dados tratados pela plataforma seguem critérios de segurança, confidencialidade e uso legítimo. Conteúdos enviados podem ser processados para análise, organização, respostas contextuais e funcionamento dos agentes.", "legal.privacy.a": "O usuário deve enviar apenas informações e documentos que tenha direito de compartilhar.", "legal.privacy.b": "Dados sensíveis devem ser tratados com cautela e somente quando necessários ao contexto.", "legal.privacy.c": "Solicitações sobre privacidade, acesso, correção ou exclusão de dados podem ser encaminhadas aos administradores do projeto.", "legal.terms.title": "Termos de Uso", "legal.terms.a": "A plataforma apoia agentes de inteligência artificial, automação assistida, organização de informações e suporte operacional em ambiente controlado.", "legal.terms.b": "Ao utilizar os recursos, o usuário concorda com uso responsável, ético e compatível com segurança, privacidade e governança.", "legal.terms.c": "É vedado uso ilegal, abusivo, fraudulento, discriminatório, invasivo ou que viole direitos de terceiros.", "legal.terms.d": "Respostas de IA podem conter imprecisões e devem ser revisadas antes de decisões operacionais, jurídicas, financeiras, médicas, técnicas ou estratégicas.", "legal.terms.e": "Execuções reais, escrita em repositório, criação de branch, abertura de PR, deploy ou alteração de ambiente dependem de aprovação explícita e fluxo governado.", "legal.terms.f": "Durante testes, podem ocorrer instabilidades, indisponibilidades, ajustes de interface e mudanças de comportamento dos agentes.", "legal.terms.g": "A plataforma é ferramenta de apoio e não substitui análise profissional especializada.", "legal.terms.h": "A continuidade de uso após atualizações poderá representar concordância com a nova versão dos termos.",
          "contact.eyebrow": "Pré-onboarding qualificado", "contact.title": "Solicite uma conversa estratégica.", "contact.copy": "Use este canal para oportunidades estratégicas, acesso privado, implantação, parcerias ou interesse profissional. Conte o contexto em poucas linhas e nossa equipe retornará após uma triagem inicial.", "contact.whatsapp": "WhatsApp estratégico", "form.name": "Nome completo", "form.email": "E-mail", "form.profile": "Perfil", "form.select": "Selecione", "form.profileA": "Empresa / Cliente", "form.profileB": "Investidor", "form.profileC": "Consultor associado", "form.profileD": "Parceiro estratégico", "form.whatsapp": "WhatsApp", "form.challenge": "Oportunidade ou desafio", "form.submit": "Preparar contato", "footer.left": "Grupo PatroAI. Consultech, Holding e AI Factory.", "footer.privacy": "Privacidade e termos", "footer.contact": "Contato", "footer.right": "Acesso privado. Proposta sob análise.", "status": "{name}, seu contato foi preparado para triagem ({profile}).", "meta.title": "PatroAI | Central de cocriação de negócios, startups e tecnologias", "meta.description": "Central de cocriação de novos negócios, startups e tecnologias, com uma boutique de IA tailor-made, governança e impacto responsável.",
        },
        es: {
          "nav.cocreation": "Cocreación", "nav.ecosystem": "Ecosistema", "nav.governance": "Gobernanza", "nav.method": "Método", "nav.contact": "Contacto", "nav.careers": "Carreras", "nav.cocreator": "Co-Creador", "nav.private": "Acceso privado", "immersive.eyebrow": "PATROAI · EXPERIENCIA INMERSIVA", "immersive.title": "Este es un entorno inmersivo.", "immersive.copy": "Elige cómo quieres iniciar tu experiencia PatroAI.", "immersive.sound.cta": "Entrar con experiencia sonora", "immersive.sound.copy": "Iniciar la obra dentro de la experiencia PatroAI", "immersive.silent": "Explorar sin sonido", "immersive.direct": "Ir directamente a la presentación", "immersive.headphones": "Recomendamos usar auriculares para una experiencia más inmersiva.", "lobby.eyebrow": "PATROAI · NÚCLEO INMERSIVO", "lobby.title": "Elige por dónde quieres entrar.", "lobby.copy": "Navega por el ecosistema mientras la experiencia sonora permanece activa.", "lobby.node.about": "Conoce PatroAI", "lobby.node.ecosystem": "Ecosistema", "lobby.node.governance": "Gobernanza", "lobby.node.method": "Método", "lobby.node.careers": "Carreras y Talentos", "lobby.node.contact": "Contacto Estratégico", "lobby.node.platform": "Acceder a la Plataforma", "lobby.hint": "Selecciona un núcleo para entrar", "lobby.dragHint": "Toca y conduce el núcleo",
          "level6.eyebrow": "Núcleo de Inteligencia Artificial Inmersiva", "level6.title": "Nivel 6: una inteligencia que estamos cocreando.", "level6.copy": "PatroAI investiga y desarrolla una nueva capa de inteligencia: sistemas que conectan agentes, contexto, presencia, música, interfaz espacial, gobernanza e impacto humano en una experiencia viva.", "level6.status": "Frontera en cocreación · concepto en desarrollo", "level6.cta": "Cocrear esta frontera", "level6.layer.context": "Contexto", "level6.layer.agents": "Agentes", "level6.layer.presence": "Presencia", "level6.layer.governance": "Gobernanza", "level6.layer.impact": "Impacto", "hero.eyebrow": "Boutique de IA a medida · Acceso privado", "hero.title": "Inteligencia <span>tailor-made</span> para contextos que exigen más.", "hero.copy": "PatroAI es una boutique de inteligencia artificial: combinamos tecnología propia, estrategia, gobernanza y especialistas internos para diseñar soluciones a medida, desde la primera hipótesis hasta la operación con valor.", "hero.primary": "Hablar con un especialista", "hero.secondary": "Conocer el alcance", "hero.kpi1": "frentes integrados para estrategia, capital relacional y tecnología.", "hero.kpi2": "por ciento orientado a gobernanza, trazabilidad y decisión.", "hero.kpi3": "entorno privado para relaciones calificadas y seguras.",
          "screen.title": "Gobernanza antes de la automatización.", "screen.copy": "Una capa ejecutiva para organizar datos, agentes, documentos, riesgos y decisiones con trazabilidad clara de responsabilidad.", "screen.signal1": "Estrategia aplicada", "screen.signal2": "Tesis y alianzas", "screen.signal3": "Sistemas a medida", "screen.signal4": "Continuidad responsable", "phone.title": "Sistemas gobernados de <span class=\"accent\">IA</span>", "phone.copy": "Claridad estratégica, tecnología y gobernanza para la decisión ejecutiva.",
          "cocreation.eyebrow": "Central de Cocreación", "cocreation.title": "Donde nuevos negocios, startups y tecnologías toman forma.", "cocreation.copy": "PatroAI conecta personas, repertorios, capital relacional y tecnología propia para transformar oportunidades en negocios, productos y ecosistemas con propósito.", "cocreation.business.title": "Nuevos negocios", "cocreation.business.copy": "Cocreamos tesis, modelos y caminos de validación para oportunidades que necesitan salir de la intención y encontrar mercado.", "cocreation.startups.title": "Startups y productos", "cocreation.startups.copy": "Apoyamos a fundadores y equipos en la construcción de productos, operaciones y decisiones orientadas por contexto, velocidad y gobernanza.", "cocreation.technology.title": "Nuevas tecnologías", "cocreation.technology.copy": "Exploramos IA, agentes, automatización e interfaces inmersivas para crear capacidades que no existen listas para usar.", "cocreation.manifesto.title": "La boutique tailor-made es nuestro modo de entrega.", "cocreation.manifesto.copy": "La central de cocreación es nuestro campo de origen: un espacio para imaginar, estructurar, probar y lanzar el próximo ciclo.", "ecosystem.eyebrow": "Ecosistema PatroAI", "ecosystem.title": "Tres frentes para construir ventaja con criterio.", "ecosystem.copy": "La propuesta combina visión ejecutiva, estructura de negocios e ingeniería aplicada para proyectos que necesitan pasar del discurso a la operación con control.", "pillars.eyebrow": "Pilares de actuación", "pillars.title": "Crecer con conciencia, cocreación e impacto.", "pillars.copy": "PatroAI conecta inteligencia, personas y responsabilidad para transformar proyectos en valor compartido.", "pillar.cocreation.title": "Cocreación", "pillar.cocreation.copy": "Construimos con emprendedores, especialistas, comunidades y aliados, convirtiendo el conocimiento colectivo en soluciones vivas.", "pillar.esg.title": "ESG", "pillar.esg.copy": "Integramos gobernanza, responsabilidad ambiental y valor social en el diseño de decisiones, operaciones y tecnologías.", "pillar.impact.title": "Impacto Social", "pillar.impact.copy": "Orientamos la innovación para ampliar oportunidades, fortalecer culturas y generar prosperidad con inclusión y continuidad.",
          "unit.consultech.copy": "Planificación, valuation, diagnóstico y apoyo ejecutivo para decisiones de alto impacto.", "unit.consultech.a": "Business plan y estrategia", "unit.consultech.b": "Modelos dinámicos de valor", "unit.consultech.c": "Soporte ejecutivo especializado", "unit.holding.copy": "Desarrollo de tesis, nuevos negocios y alianzas con potencial de escala y sinergia.", "unit.holding.a": "Proyectos por segmento", "unit.holding.b": "Conexión institucional", "unit.holding.c": "Construcción de oportunidades", "unit.factory.copy": "Sistemas, automatizaciones y entornos digitales seguros para gestión, decisión y escala operativa.", "unit.factory.a": "IA gobernada para empresas", "unit.factory.b": "Flujos ejecutivos inteligentes", "unit.factory.c": "Arquitectura a medida",
          "governance.eyebrow": "Gobernanza, ESG y continuidad", "governance.title": "IA que respeta contexto, responsabilidad y continuidad.", "governance.a": "Trazabilidad desde el diseño de la solución.", "governance.b": "Decisiones con criterio, evidencias y límites operativos.", "governance.c": "Aplicación responsable para empresas, inversores y especialistas.", "governance.d": "Arquitectura preparada para continuidad, escala y control.", "metric.a": "Diagnóstico estratégico antes de cualquier automatización.", "metric.b": "Arquitectura de IA conectada al negocio y al riesgo.", "metric.c": "Red calificada para consultores, empresas e inversores.", "metric.d": "Operación privada, controlada y orientada al valor.",
          "method.eyebrow": "Método tailor-made", "method.title": "Del contexto único al sistema que crea valor.", "method.copy": "Cada proyecto comienza por el contexto real, no por un paquete prefabricado. Priorizamos adecuación, confidencialidad y madurez operativa antes de diseñar la arquitectura correcta.", "timeline.a.title": "Evaluación estratégica", "timeline.a.copy": "Comprensión del contexto, objetivo de negocio, riesgos y prioridad real de la organización.", "timeline.b.title": "Arquitectura de valor", "timeline.b.copy": "Modelado de la oportunidad, indicadores, gobernanza y potencial de retorno operativo.", "timeline.c.title": "Prototipo controlado", "timeline.c.copy": "Diseño del flujo, validación con usuarios clave y límites claros de acceso y ejecución.", "timeline.d.title": "Escala asistida", "timeline.d.copy": "Evolución incremental con auditoría, mejora continua y alineación ejecutiva.",
          "legal.eyebrow": "Privacidad y términos", "legal.title": "Uso responsable, datos y gobernanza.", "legal.copy": "Los principios de privacidad, seguridad y uso responsable orientan el entorno PatroAI y la forma en que se tratan los datos, agentes y decisiones.", "legal.privacy.title": "Política de Privacidad", "legal.privacy.copy": "Los datos tratados por la plataforma siguen criterios de seguridad, confidencialidad y uso legítimo. Los contenidos enviados pueden procesarse para análisis, organización, respuestas contextuales y funcionamiento de los agentes.", "legal.privacy.a": "El usuario debe enviar únicamente información y documentos que tenga derecho a compartir.", "legal.privacy.b": "Los datos sensibles deben tratarse con cautela y solo cuando sean necesarios para el contexto.", "legal.privacy.c": "Las solicitudes sobre privacidad, acceso, corrección o eliminación de datos pueden enviarse a los administradores del proyecto.", "legal.terms.title": "Términos de Uso", "legal.terms.a": "La plataforma apoya agentes de inteligencia artificial, automatización asistida, organización de información y soporte operativo en un entorno controlado.", "legal.terms.b": "Al utilizar los recursos, el usuario acepta un uso responsable, ético y compatible con seguridad, privacidad y gobernanza.", "legal.terms.c": "Está prohibido el uso ilegal, abusivo, fraudulento, discriminatorio, invasivo o que viole derechos de terceros.", "legal.terms.d": "Las respuestas de IA pueden contener imprecisiones y deben revisarse antes de decisiones operativas, jurídicas, financieras, médicas, técnicas o estratégicas.", "legal.terms.e": "Las ejecuciones reales, escritura en repositorios, creación de ramas, apertura de PR, despliegues o cambios de entorno dependen de aprobación explícita y flujo gobernado.", "legal.terms.f": "Durante las pruebas pueden ocurrir inestabilidades, indisponibilidades, ajustes de interfaz y cambios en el comportamiento de los agentes.", "legal.terms.g": "La plataforma es una herramienta de apoyo y no sustituye el análisis profesional especializado.", "legal.terms.h": "La continuidad de uso después de actualizaciones podrá representar aceptación de la nueva versión de los términos.",
          "contact.eyebrow": "Pre-onboarding calificado", "contact.title": "Solicite una conversación estratégica.", "contact.copy": "Utiliza este canal para oportunidades estratégicas, acceso privado, implantación, alianzas o interés profesional. Cuenta el contexto en pocas líneas y nuestro equipo responderá tras una evaluación inicial.", "contact.whatsapp": "WhatsApp estratégico", "form.name": "Nombre completo", "form.email": "Correo electrónico", "form.profile": "Perfil", "form.select": "Seleccione", "form.profileA": "Empresa / Cliente", "form.profileB": "Inversor", "form.profileC": "Consultor asociado", "form.profileD": "Socio estratégico", "form.whatsapp": "WhatsApp", "form.challenge": "Oportunidad o desafío", "form.submit": "Preparar contacto", "footer.left": "Grupo PatroAI. Consultech, Holding y AI Factory.", "footer.privacy": "Privacidad y términos", "footer.contact": "Contacto", "footer.right": "Acceso privado. Propuesta bajo análisis.", "status": "{name}, su contacto fue preparado para evaluación ({profile}).", "meta.title": "PatroAI | Central de cocreación de negocios, startups y tecnologías", "meta.description": "Central de cocreación de nuevos negocios, startups y tecnologías, con una boutique de IA tailor-made, gobernanza e impacto responsable.",
        },
        en: {
          "nav.cocreation": "Co-creation", "nav.ecosystem": "Ecosystem", "nav.governance": "Governance", "nav.method": "Method", "nav.contact": "Contact", "nav.careers": "Careers", "nav.cocreator": "Co-Creator", "nav.private": "Private access", "immersive.eyebrow": "PATROAI · IMMERSIVE EXPERIENCE", "immersive.title": "This is an immersive environment.", "immersive.copy": "Choose how you want to start your PatroAI experience.", "immersive.sound.cta": "Enter with sound experience", "immersive.sound.copy": "Start the work inside the PatroAI experience", "immersive.silent": "Explore without sound", "immersive.direct": "Go directly to the presentation", "immersive.headphones": "Headphones are recommended for a more immersive experience.", "lobby.eyebrow": "PATROAI · IMMERSIVE CORE", "lobby.title": "Choose where you want to enter.", "lobby.copy": "Explore the ecosystem while the sound experience remains active.", "lobby.node.about": "Meet PatroAI", "lobby.node.ecosystem": "Ecosystem", "lobby.node.governance": "Governance", "lobby.node.method": "Method", "lobby.node.careers": "Careers & Talent", "lobby.node.contact": "Strategic Contact", "lobby.node.platform": "Access Platform", "lobby.hint": "Select a core to enter", "lobby.dragHint": "Touch and guide the core",
          "level6.eyebrow": "Immersive Artificial Intelligence Core", "level6.title": "Level 6: an intelligence we are co-creating.", "level6.copy": "PatroAI is researching and developing a new layer of intelligence: systems connecting agents, context, presence, music, spatial interface, governance and human impact in a living experience.", "level6.status": "Co-creation frontier · concept in development", "level6.cta": "Co-create this frontier", "level6.layer.context": "Context", "level6.layer.agents": "Agents", "level6.layer.presence": "Presence", "level6.layer.governance": "Governance", "level6.layer.impact": "Impact", "hero.eyebrow": "Tailor-made AI boutique · Private access", "hero.title": "<span>Tailor-made</span> intelligence for contexts that demand more.", "hero.copy": "PatroAI is an artificial intelligence boutique: we combine proprietary technology, strategy, governance and internal specialists to design bespoke solutions — from the first hypothesis to value-generating operations.", "hero.primary": "Talk to a specialist", "hero.secondary": "Explore our work", "hero.kpi1": "integrated fronts for strategy, relationship capital and technology.", "hero.kpi2": "percent oriented to governance, traceability and decision-making.", "hero.kpi3": "private environment for qualified and secure relationships.",
          "screen.title": "Governance before automation.", "screen.copy": "An executive layer to organize data, agents, documents, risk and decisions with clear accountability trails.", "screen.signal1": "Applied strategy", "screen.signal2": "Theses and partnerships", "screen.signal3": "Tailored systems", "screen.signal4": "Responsible continuity", "phone.title": "Governed <span class=\"accent\">AI</span> systems", "phone.copy": "Strategic clarity, technology and governance for executive decision-making.",
          "cocreation.eyebrow": "Co-creation Central", "cocreation.title": "Where new businesses, startups and technologies take shape.", "cocreation.copy": "PatroAI connects people, expertise, relationship capital and proprietary technology to turn opportunities into purposeful businesses, products and ecosystems.", "cocreation.business.title": "New businesses", "cocreation.business.copy": "We co-create theses, models and validation paths for opportunities that need to move from intention into the market.", "cocreation.startups.title": "Startups and products", "cocreation.startups.copy": "We support founders and teams in building products, operations and decisions guided by context, speed and governance.", "cocreation.technology.title": "New technologies", "cocreation.technology.copy": "We explore AI, agents, automation and immersive interfaces to create capabilities that are not available off the shelf.", "cocreation.manifesto.title": "The tailor-made boutique is our delivery mode.", "cocreation.manifesto.copy": "The co-creation central is our field of origin: a space to imagine, structure, test and launch the next cycle.", "ecosystem.eyebrow": "PatroAI Ecosystem", "ecosystem.title": "Three fronts to build advantage with discipline.", "ecosystem.copy": "The proposition combines executive vision, business structure and applied engineering for projects that need to move from discourse into controlled operation.", "pillars.eyebrow": "Fields of action", "pillars.title": "Grow with awareness, co-creation and impact.", "pillars.copy": "PatroAI connects intelligence, people and responsibility to turn projects into shared value.", "pillar.cocreation.title": "Co-creation", "pillar.cocreation.copy": "We build with entrepreneurs, specialists, communities and partners, turning collective knowledge into living solutions.", "pillar.esg.title": "ESG", "pillar.esg.copy": "We integrate governance, environmental responsibility and social value into the design of decisions, operations and technologies.", "pillar.impact.title": "Social Impact", "pillar.impact.copy": "We direct innovation toward broader opportunities, stronger cultures and prosperity with inclusion and continuity.",
          "unit.consultech.copy": "Planning, valuation, diagnosis and executive support for high-impact decisions.", "unit.consultech.a": "Business plan and strategy", "unit.consultech.b": "Dynamic value modeling", "unit.consultech.c": "Specialized executive support", "unit.holding.copy": "Development of theses, new businesses and partnerships with scale and synergy potential.", "unit.holding.a": "Segment-based projects", "unit.holding.b": "Institutional connection", "unit.holding.c": "Opportunity building", "unit.factory.copy": "Systems, automations and secure digital environments for management, decision-making and operational scale.", "unit.factory.a": "Governed AI for companies", "unit.factory.b": "Intelligent executive workflows", "unit.factory.c": "Tailored architecture",
          "governance.eyebrow": "Governance, ESG and continuity", "governance.title": "AI that respects context, responsibility and continuity.", "governance.a": "Traceability from the solution design stage.", "governance.b": "Decisions with discipline, evidence and operational boundaries.", "governance.c": "Responsible application for companies, investors and specialists.", "governance.d": "Architecture prepared for continuity, scale and control.", "metric.a": "Strategic diagnosis before any automation.", "metric.b": "AI architecture connected to business and risk.", "metric.c": "Qualified network for consultants, companies and investors.", "metric.d": "Private, controlled and value-oriented operation.",
          "method.eyebrow": "Tailor-made method", "method.title": "From a unique context to a value-creating system.", "method.copy": "Every project starts with the real context, not a shelf package. We prioritize fit, confidentiality and operational maturity before designing the right architecture.", "timeline.a.title": "Strategic triage", "timeline.a.copy": "Understanding the context, business objective, risks and the organization's real priority.", "timeline.b.title": "Value architecture", "timeline.b.copy": "Modeling the opportunity, indicators, governance and operational return potential.", "timeline.c.title": "Controlled prototype", "timeline.c.copy": "Workflow design, validation with key users and clear limits for access and execution.", "timeline.d.title": "Assisted scale", "timeline.d.copy": "Incremental evolution with audit, continuous improvement and executive alignment.",
          "legal.eyebrow": "Privacy and terms", "legal.title": "Responsible use, data and governance.", "legal.copy": "Privacy, security and responsible-use principles guide the PatroAI environment and the way data, agents and decisions are handled.", "legal.privacy.title": "Privacy Policy", "legal.privacy.copy": "Data processed by the platform follows security, confidentiality and legitimate-use criteria. Submitted content may be processed for analysis, organization, contextual responses and agent operation.", "legal.privacy.a": "Users should submit only information and documents they are entitled to share.", "legal.privacy.b": "Sensitive data should be handled carefully and only when needed for the context.", "legal.privacy.c": "Privacy, access, correction or deletion requests may be sent to the project administrators.", "legal.terms.title": "Terms of Use", "legal.terms.a": "The platform supports artificial intelligence agents, assisted automation, information organization and operational support in a controlled environment.", "legal.terms.b": "By using the resources, users agree to responsible, ethical use compatible with security, privacy and governance.", "legal.terms.c": "Illegal, abusive, fraudulent, discriminatory, invasive use or use that violates third-party rights is prohibited.", "legal.terms.d": "AI responses may contain inaccuracies and must be reviewed before operational, legal, financial, medical, technical or strategic decisions.", "legal.terms.e": "Real executions, repository writes, branch creation, PR opening, deployment or environment changes require explicit approval and a governed flow.", "legal.terms.f": "During testing, instability, downtime, interface adjustments and changes in agent behavior may occur.", "legal.terms.g": "The platform is a support tool and does not replace specialized professional analysis.", "legal.terms.h": "Continued use after updates may represent acceptance of the new terms version.",
          "contact.eyebrow": "Qualified pre-onboarding", "contact.title": "Request a strategic conversation.", "contact.copy": "Use this channel for strategic opportunities, private access, implementation, partnerships or professional interest. Share the context in a few lines and our team will respond after an initial review.", "contact.whatsapp": "Strategic WhatsApp", "form.name": "Full name", "form.email": "Email", "form.profile": "Profile", "form.select": "Select", "form.profileA": "Company / Client", "form.profileB": "Investor", "form.profileC": "Associated consultant", "form.profileD": "Strategic partner", "form.whatsapp": "WhatsApp", "form.challenge": "Opportunity or challenge", "form.submit": "Prepare contact", "footer.left": "Grupo PatroAI. Consultech, Holding and AI Factory.", "footer.privacy": "Privacy and terms", "footer.contact": "Contact", "footer.right": "Private access. Proposal under review.", "status": "{name}, your contact was prepared for triage ({profile}).", "meta.title": "PatroAI | Co-creation central for businesses, startups and technologies", "meta.description": "A co-creation central for new businesses, startups and technologies, with a tailor-made AI boutique, governance and responsible impact.",
        }
      };

Object.assign(translations.pt, {
  "careers.eyebrow": "Trabalhe conosco",
  "careers.title": "Experiência encontra inteligência.",
  "careers.copy": "Estamos formando uma rede de profissionais capazes de compreender ambientes reais, implantar inteligência artificial com governança e acelerar a evolução de empresas.",
  "careers.consulting.title": "Consultores de implantação de IA",
  "careers.consulting.copy": "Executivos, especialistas de setor e profissionais experientes para diagnóstico, desenho de processos, implantação e adoção de IA.",
  "careers.consulting.cta": "Quero atuar como consultor →",
  "careers.engineering.title": "Engenharia & IA",
  "careers.engineering.copy": "Software, agentes, dados, infraestrutura, segurança e produto para construir a próxima camada do ecossistema PatroAI.",
  "careers.engineering.cta": "Quero construir com a PatroAI →",
  "careers.partnerships.title": "Comercial & Parcerias",
  "careers.partnerships.copy": "Venda consultiva B2B, desenvolvimento de negócios e relacionamento estratégico.",
  "careers.partnerships.cta": "Quero desenvolver negócios →",
  "careers.talent.title": "Banco de talentos",
  "careers.talent.copy": "Perfis multidisciplinares para projetos, programas de formação e futuras oportunidades.",
  "careers.talent.cta": "Entrar no banco de talentos →",
  "careers.note": "As candidaturas passam por triagem qualificada, consentimento e análise de aderência ao ecossistema PatroAI.",
  "cocreator.eyebrow": "Hyper Co-Criador",
  "cocreator.title": "Um parceiro criativo para pensar e construir negócios com você.",
  "cocreator.copy": "Um único Co-Criador combina estratégia, produto, finanças, marketing, vendas, operações, tecnologia e inovação para transformar ideias e desafios em hipóteses, decisões, documentos, análises e próximos passos.",
  "cocreator.kicker": "Um agente · múltiplas capacidades",
  "cocreator.note": "Arquivos, artefatos, voz, realtime e histórico usam as capacidades governadas já disponíveis na Plataforma. A evolução da própria Plataforma permanece restrita ao plano administrativo.",
});

Object.assign(translations.es, {
  "careers.eyebrow": "Trabaja con nosotros",
  "careers.title": "La experiencia encuentra la inteligencia.",
  "careers.copy": "Estamos formando una red de profesionales capaces de comprender entornos reales, implantar inteligencia artificial con gobernanza y acelerar la evolución de empresas.",
  "careers.consulting.title": "Consultores de implantación de IA",
  "careers.consulting.copy": "Ejecutivos, especialistas de sector y profesionales experimentados para diagnóstico, diseño de procesos, implantación y adopción de IA.",
  "careers.consulting.cta": "Quiero trabajar como consultor →",
  "careers.engineering.title": "Ingeniería e IA",
  "careers.engineering.copy": "Software, agentes, datos, infraestructura, seguridad y producto para construir la próxima capa del ecosistema PatroAI.",
  "careers.engineering.cta": "Quiero construir con PatroAI →",
  "careers.partnerships.title": "Comercial y alianzas",
  "careers.partnerships.copy": "Venta consultiva B2B, desarrollo de negocios y relaciones estratégicas.",
  "careers.partnerships.cta": "Quiero desarrollar negocios →",
  "careers.talent.title": "Banco de talentos",
  "careers.talent.copy": "Perfiles multidisciplinarios para proyectos, programas de formación y futuras oportunidades.",
  "careers.talent.cta": "Entrar en el banco de talentos →",
  "careers.note": "Las candidaturas pasan por evaluación calificada, consentimiento y análisis de adecuación al ecosistema PatroAI.",
  "cocreator.eyebrow": "Hyper Co-Creador",
  "cocreator.title": "Un socio creativo para pensar y construir negocios contigo.",
  "cocreator.copy": "Un único Co-Creador combina estrategia, producto, finanzas, marketing, ventas, operaciones, tecnología e innovación para transformar ideas y desafíos en hipótesis, decisiones, documentos, análisis y próximos pasos.",
  "cocreator.kicker": "Un agente · múltiples capacidades",
  "cocreator.note": "Archivos, artefactos, voz, realtime e historial utilizan las capacidades gobernadas ya disponibles en la Plataforma. La evolución de la propia Plataforma permanece restringida al plan administrativo.",
});

Object.assign(translations.en, {
  "careers.eyebrow": "Work with us",
  "careers.title": "Where experience meets intelligence.",
  "careers.copy": "We are building a network of professionals who understand real environments, deploy governed artificial intelligence and accelerate business evolution.",
  "careers.consulting.title": "AI implementation consultants",
  "careers.consulting.copy": "Executives, sector specialists and experienced professionals for diagnosis, process design, implementation and AI adoption.",
  "careers.consulting.cta": "I want to work as a consultant →",
  "careers.engineering.title": "Engineering & AI",
  "careers.engineering.copy": "Software, agents, data, infrastructure, security and product for the next layer of the PatroAI ecosystem.",
  "careers.engineering.cta": "I want to build with PatroAI →",
  "careers.partnerships.title": "Commercial & Partnerships",
  "careers.partnerships.copy": "B2B consultative sales, business development and strategic relationships.",
  "careers.partnerships.cta": "I want to develop business →",
  "careers.talent.title": "Talent network",
  "careers.talent.copy": "Multidisciplinary profiles for projects, training programs and future opportunities.",
  "careers.talent.cta": "Join the talent network →",
  "careers.note": "Applications go through qualified review, consent and fit analysis for the PatroAI ecosystem.",
  "cocreator.eyebrow": "Hyper Co-Creator",
  "cocreator.title": "A creative partner to think through and build businesses with you.",
  "cocreator.copy": "One Co-Creator combines strategy, product, finance, marketing, sales, operations, technology and innovation to turn ideas and challenges into hypotheses, decisions, documents, analyses and next steps.",
  "cocreator.kicker": "One agent · multiple capabilities",
  "cocreator.note": "Files, artifacts, voice, realtime and history use the governed capabilities already available in the Platform. Evolution of the Platform itself remains restricted to the administrative plan.",
});

const STRATEGIC_WHATSAPP = "https://wa.me/5551989697605";

const CONTACT_STATUS: Record<string, string> = {
  pt: "Mensagem preparada no WhatsApp. Revise os dados e envie quando estiver pronto.",
  es: "Mensaje preparado en WhatsApp. Revisa los datos y envíalo cuando estés listo.",
  en: "Message prepared in WhatsApp. Review the details and send it when ready.",
};

const CONTACT_ERROR: Record<string, string> = {
  pt: "Revise os campos obrigatórios antes de continuar.",
  es: "Revisa los campos obligatorios antes de continuar.",
  en: "Review the required fields before continuing.",
};

type NeuralNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pulse: number;
};

type NeuralPointerState = {
  x: number;
  y: number;
  active: boolean;
};

type NeuralInputOptions = {
  getPointer?: () => NeuralPointerState | null;
};

export function mountPremiumLanding({
  root,
  onPrivateAccess,
  onPwaSlot,
}: PremiumLandingOptions): () => void {
  const cleanups: Array<() => void> = [];
  const timers = new Set<number>();
  const previousLang = document.documentElement.lang || "pt-BR";
  const requestedLang = new URLSearchParams(window.location.search).get("lang") || (() => {
    try {
      return window.localStorage.getItem("patroai-language") || "pt";
    } catch {
      return "pt";
    }
  })();
  let currentLang = translations[requestedLang] ? requestedLang : "pt";
  let musicEnergy = 0;
  let musicReactiveActive = false;
  const lobbyPointer: NeuralPointerState = { x: 0.5, y: 0.5, active: false };
  let lobbyPointerReleaseTimer: number | null = null;

  const query = <T extends Element>(selector: string): T | null =>
    root.querySelector<T>(selector);

  const queryAll = <T extends Element>(selector: string): T[] =>
    Array.from(root.querySelectorAll<T>(selector));

  const progress = query<HTMLElement>(".progress");
  const navLinks = query<HTMLElement>("#navLinks");
  const menuButton = query<HTMLButtonElement>("#menuButton");
  const leadForm = query<HTMLFormElement>("#leadForm");
  const formStatus = query<HTMLElement>("#formStatus");
  const screenCard = query<HTMLElement>("#screenCard");
  const langButtons = queryAll<HTMLButtonElement>("[data-lang]");
  const pwaSlot = query<HTMLElement>("#pwaInstallSlot");
  const immersiveGate = query<HTMLElement>("#immersiveGate");
  const immersiveSoundEntry = query<HTMLButtonElement>("#immersiveSoundEntry");
  const immersiveSilent = query<HTMLButtonElement>("[data-immersive-silent]");
  const immersiveDirect = query<HTMLAnchorElement>("[data-immersive-direct]");
  const immersiveReturnButtons = queryAll<HTMLButtonElement>("[data-return-immersive]");
  const copyrightToggle = query<HTMLButtonElement>("[data-copyright-toggle]");
  const copyrightPanel = query<HTMLElement>("#immersiveCopyright");
  const neuralLobby = query<HTMLElement>("#neuralLobby");
  const neuralLobbyLinks =
    queryAll<HTMLAnchorElement>("[data-neural-lobby-link]");
  const neuralLobbyBrand = query<HTMLElement>(".neural-lobby__brand");
  const neuralLobbyDragHint = query<HTMLElement>("#neuralLobbyDragHint");
  const neuralLobbyTransition = query<HTMLElement>("[data-lobby-transition]");
  const neuralLobbyCarousel = query<HTMLElement>("[data-lobby-carousel]");
  const neuralLobbyCarouselTrack = query<HTMLElement>("[data-lobby-carousel-track]");
  const neuralLobbyCarouselItems = queryAll<HTMLAnchorElement>("[data-carousel-item]");
  const neuralLobbyCarouselSteps = queryAll<HTMLButtonElement>("[data-carousel-step]");
  const neuralLobbyCarouselCurrent = query<HTMLElement>("[data-carousel-current]");
  const immersiveAudio = query<HTMLAudioElement>("#patroaiImmersiveAudio");
  const musicDock = query<HTMLElement>("#musicDock");
  const musicDockToggle = query<HTMLButtonElement>("#musicDockToggle");
  const musicDockStatus = query<HTMLElement>("#musicDockStatus");
  const musicDockIcon = query<HTMLElement>("[data-music-icon]");
  const reducedMotionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  onPwaSlot?.(pwaSlot);

  function updateProgress() {
    if (!progress) return;
    const max =
      document.documentElement.scrollHeight - window.innerHeight;
    const percent = max > 0 ? (window.scrollY / max) * 100 : 0;
    progress.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }

  function applyLanguage(lang: string) {
    currentLang = translations[lang] ? lang : "pt";
    document.documentElement.lang =
      currentLang === "pt" ? "pt-BR" : currentLang;

    queryAll<HTMLElement>("[data-i18n]").forEach((node) => {
      const key = node.dataset.i18n;
      if (key && translations[currentLang]?.[key]) {
        node.textContent = translations[currentLang][key];
      }
    });

    queryAll<HTMLElement>("[data-i18n-html]").forEach((node) => {
      const key = node.dataset.i18nHtml;
      if (key && translations[currentLang]?.[key]) {
        // Translation values are immutable source-controlled strings.
        node.innerHTML = translations[currentLang][key];
      }
    });

    const localizedTitle = translations[currentLang]?.["meta.title"];
    const localizedDescription = translations[currentLang]?.["meta.description"];
    if (localizedTitle) document.title = localizedTitle;
    if (localizedDescription) {
      document.querySelector('meta[name="description"]')?.setAttribute("content", localizedDescription);
      document.querySelector('meta[property="og:description"]')?.setAttribute("content", localizedDescription);
      document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", localizedDescription);
    }

    try {
      window.localStorage.setItem("patroai-language", currentLang);
    } catch {
      /* armazenamento indisponível: o idioma permanece nesta sessão */
    }

    const localizedUrl = new URL(window.location.href);
    if (currentLang === "pt") localizedUrl.searchParams.delete("lang");
    else localizedUrl.searchParams.set("lang", currentLang);
    const localizedHref = localizedUrl.toString();
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", localizedHref);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", localizedHref);
    window.history.replaceState(
      null,
      "",
      `${localizedUrl.pathname}${localizedUrl.search}${localizedUrl.hash}`,
    );

    langButtons.forEach((button) => {
      const isActive = button.dataset.lang === currentLang;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function animateCounts() {
    queryAll<HTMLElement>("[data-count]").forEach((item) => {
      const target = Number(item.dataset.count || 0);
      let value = 0;
      const step = Math.max(1, Math.ceil(target / 42));
      const timer = window.setInterval(() => {
        value = Math.min(target, value + step);
        item.textContent =
          target === 100
            ? `${value}%`
            : String(value).padStart(2, "0");
        if (value >= target) {
          window.clearInterval(timer);
          timers.delete(timer);
        }
      }, 24);
      timers.add(timer);
    });
  }

  function initReveal() {
    if (!("IntersectionObserver" in window)) {
      queryAll<HTMLElement>(".reveal").forEach((item) =>
        item.classList.add("visible"),
      );
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );

    queryAll<HTMLElement>(".reveal").forEach((item) =>
      observer.observe(item),
    );
    cleanups.push(() => observer.disconnect());
  }

  function initPointerGlow() {
    const onWindowPointer = (event: PointerEvent) => {
      root.style.setProperty(
        "--mx",
        `${Math.round((event.clientX / window.innerWidth) * 100)}%`,
      );
      root.style.setProperty(
        "--my",
        `${Math.round((event.clientY / window.innerHeight) * 100)}%`,
      );
    };

    window.addEventListener("pointermove", onWindowPointer, {
      passive: true,
    });
    cleanups.push(() =>
      window.removeEventListener("pointermove", onWindowPointer),
    );

    if (!screenCard) return;

    const onCardPointer = (event: PointerEvent) => {
      const rect = screenCard.getBoundingClientRect();
      const x =
        ((event.clientX - rect.left) / rect.width - 0.5) * 5;
      const y =
        ((event.clientY - rect.top) / rect.height - 0.5) * -4;
      screenCard.style.setProperty(
        "--tilt-x",
        `${x.toFixed(2)}deg`,
      );
      screenCard.style.setProperty(
        "--tilt-y",
        `${y.toFixed(2)}deg`,
      );
    };

    const onCardLeave = () => {
      screenCard.style.setProperty("--tilt-x", "0deg");
      screenCard.style.setProperty("--tilt-y", "0deg");
    };

    screenCard.addEventListener("pointermove", onCardPointer);
    screenCard.addEventListener("pointerleave", onCardLeave);
    cleanups.push(() => {
      screenCard.removeEventListener("pointermove", onCardPointer);
      screenCard.removeEventListener("pointerleave", onCardLeave);
    });
  }

  function initBrainCanvas2D(
    selector = "#brainCanvas",
    densityMultiplier = 1,
    options: NeuralInputOptions = {},
  ) {
    const canvasNode = query<HTMLCanvasElement>(selector);
    const stageNode = canvasNode?.parentElement as HTMLElement | null;
    const context = canvasNode?.getContext("2d");

    if (!canvasNode || !stageNode || !context) return;

    const canvas = canvasNode;
    const stage = stageNode;
    const ctx = context;
    const nodes: NeuralNode[] = [];
    const pointer = { x: 0.5, y: 0.5, active: false };
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    let inViewport = true;
    let stopped = false;

    function resize() {
      const rect = stage.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes.length = 0;
      const baseCount =
        width < 360 ? 34 : width < 720 ? 48 : 62;
      const count = Math.max(
        24,
        Math.round(baseCount * densityMultiplier),
      );

      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count;
        const radius = 0.18 + Math.random() * 0.36;
        nodes.push({
          x:
            0.5 +
            Math.cos(angle) *
              radius *
              (0.92 + Math.random() * 0.25),
          y:
            0.5 +
            Math.sin(angle) *
              radius *
              (0.72 + Math.random() * 0.28),
          vx: (Math.random() - 0.5) * 0.0012,
          vy: (Math.random() - 0.5) * 0.0012,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw(time: number, advance: boolean) {
      ctx.clearRect(0, 0, width, height);
      const t = time * 0.001;
      const externalPointer = options.getPointer?.();
      if (externalPointer?.active) {
        pointer.active = true;
        pointer.x = Math.min(1, Math.max(0, externalPointer.x));
        pointer.y = Math.min(1, Math.max(0, externalPointer.y));
      }
      const cx = width * 0.5;
      const cy = height * 0.5;
      const reactiveEnergy =
        musicReactiveActive && !reducedMotion.matches
          ? Math.min(1, Math.max(0, musicEnergy))
          : 0;
      const driftBoost = 1 + reactiveEnergy * 2.4;
      const connectionDistance = 86 + reactiveEnergy * 28;
      const connectionAlphaBoost = 1 + reactiveEnergy * 0.95;
      const nodeRadiusBoost = reactiveEnergy * 1.2;
      const haloBoost = reactiveEnergy * 9;
      const coreRadius =
        Math.min(width, height) * (0.34 + reactiveEnergy * 0.055);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      nodes.forEach((node, index) => {
        if (advance) {
          const pull = pointer.active ? 0.0009 : 0.00035;
          node.x +=
            node.vx * driftBoost +
            (0.5 - node.x) * pull +
            Math.sin(t + index) * (0.00045 * driftBoost);
          node.y +=
            node.vy * driftBoost +
            (0.5 - node.y) * pull +
            Math.cos(t * 0.8 + index) * (0.00038 * driftBoost);

          if (pointer.active) {
            const dx = pointer.x - node.x;
            const dy = pointer.y - node.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 0.38) {
              node.x += dx * 0.003;
              node.y += dy * 0.003;
            }
          }

          if (node.x < 0.09 || node.x > 0.91) node.vx *= -1;
          if (node.y < 0.12 || node.y > 0.88) node.vy *= -1;
        }
      });

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const ax = a.x * width;
          const ay = a.y * height;
          const bx = b.x * width;
          const by = b.y * height;
          const dist = Math.hypot(ax - bx, ay - by);

          if (dist < connectionDistance) {
            const alpha =
              (1 - dist / connectionDistance) *
              0.38 *
              connectionAlphaBoost;
            const goldPulse =
              0.5 + Math.sin(t * 2.1 + i + j) * 0.5;
            ctx.strokeStyle = `rgba(${
              goldPulse > 0.82
                ? "217,180,95"
                : "40,240,181"
            }, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }

      nodes.forEach((node, index) => {
        const x = node.x * width;
        const y = node.y * height;
        const glow =
          0.55 + Math.sin(t * 2.6 + node.pulse) * 0.45;
        const nearCore =
          Math.hypot(x - cx, y - cy) <
          Math.min(width, height) * 0.2;

        ctx.fillStyle = nearCore
          ? `rgba(255, 235, 176, ${0.42 + glow * 0.36})`
          : `rgba(40, 240, 181, ${0.28 + glow * 0.34})`;
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          (nearCore ? 2.2 : 1.7) + nodeRadiusBoost,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        if (index % 9 === 0) {
          ctx.strokeStyle =
            `rgba(217, 180, 95, ${0.14 + glow * 0.24})`;
          ctx.beginPath();
          ctx.arc(
            x,
            y,
            8 + glow * 7 + haloBoost,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      });

      const core = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        coreRadius,
      );
      core.addColorStop(0, "rgba(255, 238, 174, 0.34)");
      core.addColorStop(0.35, "rgba(40, 240, 181, 0.14)");
      core.addColorStop(1, "rgba(40, 240, 181, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        coreRadius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      canvas.dataset.neuralMotion = reducedMotion.matches ? "reduced" : "running";
      canvas.dataset.neuralFrame = String(Math.floor(time / 120));
    }

    function frame(time: number) {
      if (stopped) return;

      const shouldAnimate =
        !reducedMotion.matches &&
        inViewport &&
        document.visibilityState === "visible";

      if (shouldAnimate) {
        draw(time, true);
      }

      animationFrame = window.requestAnimationFrame(frame);
    }

    function drawReducedFrame() {
      if (reducedMotion.matches && inViewport) {
        draw(performance.now(), false);
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width;
      pointer.y = (event.clientY - rect.top) / rect.height;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onResize = () => {
      resize();
      if (reducedMotion.matches) drawReducedFrame();
    };

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        reducedMotion.matches
      ) {
        drawReducedFrame();
      }
    };

    const onMotionChange = () => {
      drawReducedFrame();
    };

    resize();
    draw(performance.now(), !reducedMotion.matches);

    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", onResize);
    document.addEventListener(
      "visibilitychange",
      onVisibilityChange,
    );
    const removeMotionChangeListener = addMediaQueryChangeListener(
      reducedMotion,
      onMotionChange,
    );

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          inViewport = entries.some(
            (entry) => entry.target === stage && entry.isIntersecting,
          );
          if (inViewport && reducedMotion.matches) {
            drawReducedFrame();
          }
        },
        { threshold: 0.05 },
      );
      observer.observe(stage);
    }

    animationFrame = window.requestAnimationFrame(frame);

    cleanups.push(() => {
      stopped = true;
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      removeMotionChangeListener();
      delete canvas.dataset.neuralRenderer;
      delete canvas.dataset.neuralMotion;
      delete canvas.dataset.neuralFrame;
    });
    canvas.dataset.neuralRenderer = "canvas2d";
  }

  function initLobbyLogoControl() {
    if (!neuralLobby || !neuralLobbyBrand) return;

    const position = { x: 0, y: 0 };
    const drag = {
      pointerId: null as number | null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
      active: false,
    };

    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));

    const updateNeuralPointer = () => {
      const rect = neuralLobby.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      lobbyPointer.x = clamp((rect.width * 0.5 + position.x) / rect.width, 0, 1);
      lobbyPointer.y = clamp((rect.height * 0.5 + position.y) / rect.height, 0, 1);
      lobbyPointer.active = true;
    };

    const applyPosition = (x: number, y: number) => {
      const rect = neuralLobby.getBoundingClientRect();
      const halfLogo = Math.max(42, neuralLobbyBrand.offsetWidth * 0.5);
      const safeX = Math.max(24, rect.width * 0.5 - halfLogo - 18);
      const safeY = Math.max(24, rect.height * 0.5 - halfLogo - 18);
      position.x = clamp(x, -safeX, safeX);
      position.y = clamp(y, -safeY, safeY);
      neuralLobbyBrand.style.setProperty("--logo-drag-x", `${position.x.toFixed(2)}px`);
      neuralLobbyBrand.style.setProperty("--logo-drag-y", `${position.y.toFixed(2)}px`);
      updateNeuralPointer();
    };

    const releasePointer = () => {
      drag.active = false;
      neuralLobbyBrand.classList.remove("is-dragging");
      if (
        drag.pointerId !== null &&
        drag.pointerId >= 0 &&
        neuralLobbyBrand.hasPointerCapture(drag.pointerId)
      ) {
        neuralLobbyBrand.releasePointerCapture(drag.pointerId);
      }
      drag.pointerId = null;
      if (lobbyPointerReleaseTimer !== null) {
        window.clearTimeout(lobbyPointerReleaseTimer);
      }
      lobbyPointerReleaseTimer = window.setTimeout(() => {
        lobbyPointer.active = false;
        lobbyPointerReleaseTimer = null;
      }, 900);
    };

    const recenter = () => {
      applyPosition(0, 0);
      neuralLobbyBrand.classList.add("is-recentering");
      window.setTimeout(() => neuralLobbyBrand.classList.remove("is-recentering"), 260);
      if (neuralLobbyDragHint) neuralLobbyDragHint.hidden = false;
      releasePointer();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (drag.active || (event.pointerType !== "touch" && event.button !== 0)) return;
      drag.pointerId = event.pointerId;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.originX = position.x;
      drag.originY = position.y;
      drag.active = true;
      neuralLobbyBrand.classList.add("is-dragging");
      if (neuralLobbyDragHint) neuralLobbyDragHint.hidden = true;
      neuralLobbyBrand.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      applyPosition(
        drag.originX + event.clientX - drag.startX,
        drag.originY + event.clientY - drag.startY,
      );
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (drag.pointerId !== event.pointerId) return;
      releasePointer();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (drag.active) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      drag.pointerId = -1;
      drag.startX = touch.clientX;
      drag.startY = touch.clientY;
      drag.originX = position.x;
      drag.originY = position.y;
      drag.active = true;
      neuralLobbyBrand.classList.add("is-dragging");
      if (neuralLobbyDragHint) neuralLobbyDragHint.hidden = true;
      event.preventDefault();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!drag.active || drag.pointerId !== -1) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      applyPosition(
        drag.originX + touch.clientX - drag.startX,
        drag.originY + touch.clientY - drag.startY,
      );
      event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (drag.pointerId !== -1) return;
      event.preventDefault();
      releasePointer();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Home" || event.key === "Escape") {
        event.preventDefault();
        recenter();
        return;
      }
      const step = event.shiftKey ? 28 : 14;
      const offsets: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const offset = offsets[event.key];
      if (!offset) return;
      event.preventDefault();
      applyPosition(position.x + offset[0], position.y + offset[1]);
      if (neuralLobbyDragHint) neuralLobbyDragHint.hidden = true;
    };

    neuralLobbyBrand.addEventListener("pointerdown", onPointerDown);
    // Samsung Internet can lose pointer capture when transformed layers move.
    // Track movement at window level so dragging remains continuous even when
    // the finger leaves the logo's original hit box.
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });
    neuralLobbyBrand.addEventListener("touchstart", onTouchStart, { passive: false });
    neuralLobbyBrand.addEventListener("touchmove", onTouchMove, { passive: false });
    neuralLobbyBrand.addEventListener("touchend", onTouchEnd, { passive: false });
    neuralLobbyBrand.addEventListener("touchcancel", onTouchEnd, { passive: false });
    neuralLobbyBrand.addEventListener("keydown", onKeyDown);
    neuralLobbyBrand.addEventListener("dblclick", recenter);
    applyPosition(0, 0);

    cleanups.push(() => {
      if (lobbyPointerReleaseTimer !== null) {
        window.clearTimeout(lobbyPointerReleaseTimer);
      }
      neuralLobbyBrand.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      neuralLobbyBrand.removeEventListener("touchstart", onTouchStart);
      neuralLobbyBrand.removeEventListener("touchmove", onTouchMove);
      neuralLobbyBrand.removeEventListener("touchend", onTouchEnd);
      neuralLobbyBrand.removeEventListener("touchcancel", onTouchEnd);
      neuralLobbyBrand.removeEventListener("keydown", onKeyDown);
      neuralLobbyBrand.removeEventListener("dblclick", recenter);
      neuralLobbyBrand.style.removeProperty("--logo-drag-x");
      neuralLobbyBrand.style.removeProperty("--logo-drag-y");
      lobbyPointer.active = false;
    });
  }

  function initLobbyCarousel() {
    if (!neuralLobbyCarousel || !neuralLobbyCarouselTrack || neuralLobbyCarouselItems.length === 0) return;
    let index = 0;
    let startX = 0;
    let dragging = false;
    let pointerId: number | null = null;

    const sync = (next: number, focus = false) => {
      index = (next + neuralLobbyCarouselItems.length) % neuralLobbyCarouselItems.length;
      neuralLobbyCarouselTrack.style.setProperty("--carousel-index", String(index));
      const itemCount = neuralLobbyCarouselItems.length;
      const step = Math.min(window.innerWidth * .68, 250);
      neuralLobbyCarouselItems.forEach((item, itemIndex) => {
        let offset = itemIndex - index;
        if (offset > itemCount / 2) offset -= itemCount;
        if (offset < -itemCount / 2) offset += itemCount;
        const distance = Math.abs(offset);
        const active = offset === 0;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-current", active ? "true" : "false");
        item.style.setProperty("--carousel-x", `${offset * step}px`);
        item.style.setProperty("--carousel-depth", `${-distance * 72}px`);
        item.style.setProperty("--carousel-scale", String(Math.max(.58, 1 - distance * .16)));
        item.style.setProperty("--carousel-rotate", `${offset * -18}deg`);
        item.style.setProperty("--carousel-opacity", String(Math.max(.22, 1 - distance * .23)));
        item.style.setProperty("--carousel-blur", `${Math.min(3, distance * .8)}px`);
        item.style.setProperty("--carousel-z", String(itemCount - distance));
      });
      if (neuralLobbyCarouselCurrent) neuralLobbyCarouselCurrent.textContent = String(index + 1);
      if (focus) neuralLobbyCarouselItems[index]?.focus({ preventScroll: true });
    };

    const onStep = (event: MouseEvent) => {
      const step = Number((event.currentTarget as HTMLElement).dataset.carouselStep || 0);
      sync(index + step, true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        sync(index - 1, true);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        sync(index + 1, true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && event.button !== 0) return;
      dragging = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      neuralLobbyCarousel.setPointerCapture?.(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging || pointerId !== event.pointerId) return;
      const delta = event.clientX - startX;
      dragging = false;
      pointerId = null;
      if (Math.abs(delta) > 28) sync(index + (delta < 0 ? 1 : -1), true);
    };
    const onPointerCancel = () => {
      dragging = false;
      pointerId = null;
    };
    const onResize = () => sync(index);

    neuralLobbyCarouselSteps.forEach((button) => button.addEventListener("click", onStep));
    neuralLobbyCarousel.addEventListener("keydown", onKeyDown);
    neuralLobbyCarousel.addEventListener("pointerdown", onPointerDown);
    neuralLobbyCarousel.addEventListener("pointerup", onPointerUp);
    neuralLobbyCarousel.addEventListener("pointercancel", onPointerCancel);
    neuralLobbyCarousel.addEventListener("pointerleave", onPointerCancel);
    window.addEventListener("resize", onResize, { passive: true });
    sync(0);

    cleanups.push(() => {
      neuralLobbyCarouselSteps.forEach((button) => button.removeEventListener("click", onStep));
      neuralLobbyCarousel.removeEventListener("keydown", onKeyDown);
      neuralLobbyCarousel.removeEventListener("pointerdown", onPointerDown);
      neuralLobbyCarousel.removeEventListener("pointerup", onPointerUp);
      neuralLobbyCarousel.removeEventListener("pointercancel", onPointerCancel);
      neuralLobbyCarousel.removeEventListener("pointerleave", onPointerCancel);
      window.removeEventListener("resize", onResize);
    });
  }

  function initBrainCanvas(
    selector = "#brainCanvas",
    densityMultiplier = 1,
    options: NeuralInputOptions = {},
  ) {
    const canvas = query<HTMLCanvasElement>(selector);
    const stage = canvas?.parentElement as HTMLElement | null;
    if (!canvas || !stage) return;

    const webgl = initNeuralWebgl(canvas, stage, {
      getEnergy: () => Math.min(1, musicEnergy * 0.58 + audioBassLevel * 0.34 + audioBeatLevel * 0.82),
      getReactive: () => musicReactiveActive,
      getPointer: options.getPointer,
    });

    if (!webgl) {
      initBrainCanvas2D(selector, densityMultiplier, options);
      return;
    }

    canvas.dataset.neuralRenderer = "webgl2";
    let inViewport = true;
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            inViewport = entries.some(
              (entry) => entry.target === stage && entry.isIntersecting,
            );
            webgl.setViewport(inViewport);
          },
          { threshold: 0.05 },
        )
      : null;
    observer?.observe(stage);

    cleanups.push(() => {
      observer?.disconnect();
      webgl.destroy();
      delete canvas.dataset.neuralRenderer;
    });
  }

  if (menuButton && navLinks) {
    const onMenu = () => {
      const open = navLinks.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
    };
    const onNavClick = (event: Event) => {
      if ((event.target as Element | null)?.matches("a")) {
        navLinks.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    };

    menuButton.addEventListener("click", onMenu);
    navLinks.addEventListener("click", onNavClick);
    cleanups.push(() => {
      menuButton.removeEventListener("click", onMenu);
      navLinks.removeEventListener("click", onNavClick);
    });
  }

  langButtons.forEach((button) => {
    const onLanguage = () =>
      applyLanguage(button.dataset.lang || "pt");
    button.addEventListener("click", onLanguage);
    cleanups.push(() =>
      button.removeEventListener("click", onLanguage),
    );
  });

  applyLanguage(currentLang);

  if (immersiveGate) {
    immersiveGate.hidden = false;
    immersiveGate.classList.remove("is-leaving");
    neuralLobby?.classList.remove("is-active", "is-exiting", "is-transitioning");
    neuralLobby?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("neural-lobby-open");
    document.body.classList.add("immersive-gate-open");

    const openNeuralLobby = () => {
      if (!neuralLobby) return;
      neuralLobby.classList.remove("is-exiting");
      neuralLobby.classList.add("is-active");
      neuralLobby.setAttribute("aria-hidden", "false");
      document.body.classList.add("neural-lobby-open");
      window.setTimeout(() => neuralLobbyLinks[0]?.focus(), 40);
    };

    const enableMotionOverride = () => {
      document.documentElement.dataset.motionOverride = "on";
      document.body.dataset.motionOverride = "on";
      root.dataset.motionOverride = "on";
    };

    const returnToImmersiveLobby = (event?: Event) => {
      event?.preventDefault();
      navLinks?.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
      window.scrollTo({ top: 0, behavior: "auto" });
      openNeuralLobby();
    };

    immersiveReturnButtons.forEach((button) => {
      const onReturnToImmersive = (event: Event) => returnToImmersiveLobby(event);
      button.addEventListener("click", onReturnToImmersive);
      cleanups.push(() => button.removeEventListener("click", onReturnToImmersive));
    });

    const closeImmersiveGate = () => {
      immersiveGate.classList.add("is-leaving");
      window.setTimeout(() => {
        immersiveGate.hidden = true;
        document.body.classList.remove("immersive-gate-open");
        openNeuralLobby();
      }, 520);
    };

    const enterPresentationDirectly = (event?: Event) => {
      enableMotionOverride();
      event?.preventDefault();
      immersiveGate.classList.add("is-leaving");
      window.setTimeout(() => {
        immersiveGate.hidden = true;
        document.body.classList.remove("immersive-gate-open");
        neuralLobby?.classList.remove("is-active");
        neuralLobby?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("neural-lobby-open");
        document.querySelector<HTMLElement>("#top")?.scrollIntoView({
          behavior: reducedMotionPreference.matches ? "auto" : "smooth",
          block: "start",
        });
      }, 520);
    };

    const closeNeuralLobby = (targetSelector?: string) => {
      if (!neuralLobby) return;
      neuralLobby.classList.add("is-exiting");
      neuralLobby.classList.remove("is-active");
      neuralLobby.setAttribute("aria-hidden", "true");

      window.setTimeout(() => {
        document.body.classList.remove("neural-lobby-open");
        if (!targetSelector) return;
        const target = document.querySelector<HTMLElement>(
          targetSelector,
        );
        target?.scrollIntoView({
          behavior: reducedMotionPreference.matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      }, 680);
    };

    let lobbyTransitionLocked = false;

    const prepareLobbyTransition = (anchor: HTMLAnchorElement) => {
      if (!neuralLobby || !neuralLobbyTransition || !neuralLobbyBrand) return;

      const source = anchor.getBoundingClientRect();
      const core = neuralLobbyBrand.getBoundingClientRect();
      const lobby = neuralLobby.getBoundingClientRect();

      const sx = source.left + source.width * 0.5 - lobby.left;
      const sy = source.top + source.height * 0.5 - lobby.top;
      const cx = core.left + core.width * 0.5 - lobby.left;
      const cy = core.top + core.height * 0.5 - lobby.top;
      const dx = cx - sx;
      const dy = cy - sy;
      const distance = Math.max(48, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      neuralLobby.style.setProperty("--transition-source-x", `${sx}px`);
      neuralLobby.style.setProperty("--transition-source-y", `${sy}px`);
      neuralLobby.style.setProperty("--transition-core-x", `${cx}px`);
      neuralLobby.style.setProperty("--transition-core-y", `${cy}px`);
      neuralLobby.style.setProperty("--transition-beam-length", `${distance}px`);
      neuralLobby.style.setProperty("--transition-beam-angle", `${angle}deg`);
      const transitionAccent =
        getComputedStyle(anchor).getPropertyValue("--node-accent").trim() ||
        "#37C5FF";
      neuralLobby.style.setProperty("--transition-accent", transitionAccent);

      neuralLobbyLinks.forEach((link) => link.classList.remove("is-selected"));
      anchor.classList.add("is-selected");
      neuralLobby.classList.add("is-transitioning");
      neuralLobbyTransition.setAttribute("aria-hidden", "false");
    };

    const finishLobbyTransition = () => {
      if (!neuralLobby || !neuralLobbyTransition) return;
      neuralLobby.classList.remove("is-transitioning");
      neuralLobbyLinks.forEach((link) => link.classList.remove("is-selected"));
      neuralLobbyTransition.setAttribute("aria-hidden", "true");
      neuralLobby.style.removeProperty("--transition-source-x");
      neuralLobby.style.removeProperty("--transition-source-y");
      neuralLobby.style.removeProperty("--transition-core-x");
      neuralLobby.style.removeProperty("--transition-core-y");
      neuralLobby.style.removeProperty("--transition-beam-length");
      neuralLobby.style.removeProperty("--transition-beam-angle");
      neuralLobby.style.removeProperty("--transition-accent");
      lobbyTransitionLocked = false;
    };

    const runLobbyTransition = async (
      anchor: HTMLAnchorElement,
      destination: () => void | Promise<void>,
    ) => {
      if (lobbyTransitionLocked) return;
      lobbyTransitionLocked = true;

      if (reducedMotionPreference.matches) {
        await Promise.resolve(destination());
        lobbyTransitionLocked = false;
        return;
      }

      prepareLobbyTransition(anchor);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 760);
      });
      await Promise.resolve(destination());
      window.setTimeout(finishLobbyTransition, 760);
    };

    const syncMusicDock = () => {
      if (!immersiveAudio || !musicDock) return;
      musicDock.hidden = false;
      const paused = immersiveAudio.paused;
      if (musicDockIcon) musicDockIcon.textContent = paused ? "▶" : "Ⅱ";
      if (musicDockToggle) {
        musicDockToggle.setAttribute(
          "aria-label",
          paused ? "Reproduzir música" : "Pausar música",
        );
      }
      if (musicDockStatus) {
        musicDockStatus.textContent = immersiveAudio.ended
          ? "Obra concluída"
          : paused
            ? "Experiência sonora pausada"
            : "Reproduzindo obra imersiva";
      }
    };

    let audioContext: AudioContext | null = null;
    let audioMasterGain: GainNode | null = null;
    let audioCompressor: DynamicsCompressorNode | null = null;
    let audioAnalyser: AnalyserNode | null = null;
    let audioReactiveFrame = 0;
    let audioReactiveLevel = 0;
    let audioBassLevel = 0;
    let audioMidLevel = 0;
    let audioHighLevel = 0;
    let audioBeatFast = 0;
    let audioBeatSlow = 0;
    let audioBeatLevel = 0;
    let audioReactiveReady = false;
    let desktopNeuralMotionFrame = 0;
    const audioPlaylist = [
      "/media/patroai-threshold.mp3",
      "/media/patroai-threshold-02.mp3",
      "/media/landingpage111hz-remix.mp3",
      "/media/patroai-immersive-111hz.mp3",
    ];
    let audioTrackIndex = 0;

    // V8 adaptive quality governor. Visual fidelity is reduced before musical
    // responsiveness, so a slower GPU does not turn the whole scene into slow motion.
    let performanceGovernorFrame = 0;
    let performanceGovernorLast = 0;
    let performanceGovernorAccumulated = 0;
    let performanceGovernorSamples = 0;
    let performanceProfile: "full" | "balanced" | "performance" = "full";
    let performanceLastDecision = 0;

    const applyPerformanceProfile = (
      profile: "full" | "balanced" | "performance",
    ) => {
      if (performanceProfile === profile && root.dataset.immersiveQuality === profile) return;
      performanceProfile = profile;
      root.dataset.immersiveQuality = profile;
    };

    const initialPerformanceProfile = () => {
      const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0);
      const cores = Number(navigator.hardwareConcurrency || 0);
      const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (window.innerWidth <= 820 || coarsePointer) {
        return "performance" as const;
      }
      if ((memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) {
        return "balanced" as const;
      }
      return "full" as const;
    };

    const runPerformanceGovernor = (timestamp: number) => {
      performanceGovernorFrame = window.requestAnimationFrame(runPerformanceGovernor);
      if (!neuralLobby?.classList.contains("is-active") || document.hidden) {
        performanceGovernorLast = timestamp;
        performanceGovernorAccumulated = 0;
        performanceGovernorSamples = 0;
        return;
      }

      if (!performanceGovernorLast) {
        performanceGovernorLast = timestamp;
        return;
      }

      const frameTime = Math.min(100, Math.max(1, timestamp - performanceGovernorLast));
      performanceGovernorLast = timestamp;
      performanceGovernorAccumulated += frameTime;
      performanceGovernorSamples += 1;

      if (performanceGovernorSamples < 30 || timestamp - performanceLastDecision < 900) return;

      const averageFrameTime = performanceGovernorAccumulated / performanceGovernorSamples;
      const fps = 1000 / averageFrameTime;
      performanceGovernorAccumulated = 0;
      performanceGovernorSamples = 0;
      performanceLastDecision = timestamp;

      const mobileLike =
        window.innerWidth <= 820 ||
        window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (fps < 42) {
        applyPerformanceProfile("performance");
      } else if (fps < 55 || mobileLike) {
        // Mobile never auto-upgrades to the expensive FULL profile.
        applyPerformanceProfile("balanced");
      } else if (fps > 58) {
        applyPerformanceProfile("full");
      }
    };

    applyPerformanceProfile(initialPerformanceProfile());
    performanceGovernorFrame = window.requestAnimationFrame(runPerformanceGovernor);
    cleanups.push(() => {
      if (performanceGovernorFrame) window.cancelAnimationFrame(performanceGovernorFrame);
      root.removeAttribute("data-immersive-quality");
    });

    const selectAudioTrack = (index: number) => {
      if (!immersiveAudio) return;
      audioTrackIndex = Math.min(
        Math.max(index, 0),
        audioPlaylist.length - 1,
      );
      immersiveAudio.src = audioPlaylist[audioTrackIndex];
      immersiveAudio.volume = 0.58;
      immersiveAudio.load();
      if (musicDockStatus) {
        musicDockStatus.textContent = `Faixa ${audioTrackIndex + 1} de ${audioPlaylist.length}`;
      }
    };

    const resetAudioReactiveLogo = () => {
      if (audioReactiveFrame) {
        window.cancelAnimationFrame(audioReactiveFrame);
        audioReactiveFrame = 0;
      }
      audioReactiveLevel = 0;
      audioBassLevel = 0;
      audioMidLevel = 0;
      audioHighLevel = 0;
      audioBeatFast = 0;
      audioBeatSlow = 0;
      audioBeatLevel = 0;
      musicEnergy = 0;
      musicReactiveActive = false;
      root.classList.remove("music-reactive-active");
      root.style.removeProperty("--music-logo-scale");
      root.style.removeProperty("--music-logo-lift");
      root.style.removeProperty("--music-logo-glow");
      root.style.removeProperty("--music-aura-scale");
      root.style.removeProperty("--music-aura-opacity");
      root.style.removeProperty("--music-dock-energy");
      root.style.removeProperty("--music-energy");
      root.style.removeProperty("--music-pulse");
      root.style.removeProperty("--music-bass");
      root.style.removeProperty("--music-mid");
      root.style.removeProperty("--music-high");
      root.style.removeProperty("--music-beat");
      root.style.removeProperty("--music-beat-flash");
      root.style.removeProperty("--music-motion-duration");
    };

    const renderAudioReactiveLogo = () => {
      if (
        !immersiveAudio ||
        !audioAnalyser ||
        !audioContext ||
        immersiveAudio.paused ||
        immersiveAudio.ended ||
        (reducedMotionPreference.matches && root.dataset.motionOverride !== "on")
      ) {
        resetAudioReactiveLogo();
        return;
      }

      const frequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
      audioAnalyser.getByteFrequencyData(frequencyData);

      const nyquist = audioContext.sampleRate / 2;
      const hzPerBin = nyquist / frequencyData.length;

      const bandEnergy = (minHz: number, maxHz: number) => {
        const startBin = Math.max(0, Math.floor(minHz / hzPerBin));
        const endBin = Math.min(
          frequencyData.length - 1,
          Math.ceil(maxHz / hzPerBin),
        );
        let total = 0;
        let count = 0;
        for (let index = startBin; index <= endBin; index += 1) {
          total += frequencyData[index];
          count += 1;
        }
        return count ? total / count / 255 : 0;
      };

      // Four independent musical signals. This makes the visuals follow the
      // actual content of each track instead of a fixed CSS animation/BPM.
      const rawBass = bandEnergy(35, 180);
      const rawMid = bandEnergy(180, 2200);
      const rawHigh = bandEnergy(2200, 9000);
      const rawEnergy = Math.min(
        1,
        rawBass * 0.50 + rawMid * 0.34 + rawHigh * 0.16,
      );

      const smoothBand = (
        current: number,
        target: number,
        attack: number,
        release: number,
      ) => current + (target - current) * (target > current ? attack : release);

      // V8: the kick/bass path must feel immediate. Musical body still gets
      // smoothing so the scene does not flicker between frames.
      audioBassLevel = smoothBand(audioBassLevel, rawBass, 0.66, 0.16);
      audioMidLevel = smoothBand(audioMidLevel, rawMid, 0.40, 0.11);
      audioHighLevel = smoothBand(audioHighLevel, rawHigh, 0.38, 0.10);
      audioReactiveLevel = smoothBand(audioReactiveLevel, rawEnergy, 0.40, 0.10);

      // Beat detection: a fast bass envelope is compared with a slower moving
      // baseline. Strong kick/transient events create a short visual impulse.
      audioBeatFast += (rawBass - audioBeatFast) * 0.72;
      audioBeatSlow += (rawBass - audioBeatSlow) * 0.028;
      const beatDelta = Math.max(0, audioBeatFast - audioBeatSlow * 1.015);
      const beatCandidate = Math.min(1, beatDelta * 12.5);
      audioBeatLevel =
        beatCandidate > audioBeatLevel
          ? audioBeatLevel + (beatCandidate - audioBeatLevel) * 0.93
          : audioBeatLevel * 0.70;

      const normalized = Math.min(1, Math.max(0, audioReactiveLevel * 1.72));
      const bass = Math.min(1, Math.max(0, audioBassLevel * 1.55));
      const mid = Math.min(1, Math.max(0, audioMidLevel * 1.62));
      const high = Math.min(1, Math.max(0, audioHighLevel * 1.78));
      const beat = Math.min(1, Math.max(0, audioBeatLevel));
      const pulse = Math.min(
        1,
        Math.max(0, bass * 0.54 + normalized * 0.22 + beat * 0.86),
      );

      musicEnergy = normalized;
      musicReactiveActive = true;

      const scale = 1 + normalized * 0.035 + bass * 0.025 + beat * 0.055;
      const lift = -(normalized * 1.8 + beat * 2.2);
      const glow = 0.30 + normalized * 0.34 + bass * 0.16 + beat * 0.30;
      const auraScale = 0.98 + normalized * 0.08 + bass * 0.05 + beat * 0.10;
      const auraOpacity = 0.56 + normalized * 0.24 + beat * 0.20;

      root.classList.add("music-reactive-active");
      root.style.setProperty("--music-logo-scale", scale.toFixed(4));
      root.style.setProperty("--music-logo-lift", `${lift.toFixed(2)}px`);
      root.style.setProperty("--music-logo-glow", Math.min(1, glow).toFixed(3));
      root.style.setProperty("--music-aura-scale", auraScale.toFixed(4));
      root.style.setProperty("--music-aura-opacity", Math.min(1, auraOpacity).toFixed(3));
      root.style.setProperty("--music-dock-energy", normalized.toFixed(3));
      root.style.setProperty("--music-energy", normalized.toFixed(3));
      root.style.setProperty("--music-pulse", pulse.toFixed(3));
      root.style.setProperty("--music-bass", bass.toFixed(3));
      root.style.setProperty("--music-mid", mid.toFixed(3));
      root.style.setProperty("--music-high", high.toFixed(3));
      root.style.setProperty("--music-beat", beat.toFixed(3));
      root.style.setProperty("--music-beat-flash", (beat * beat).toFixed(3));

      audioReactiveFrame = window.requestAnimationFrame(renderAudioReactiveLogo);
    };
    const ensureAudioReactiveLogo = async () => {
      if (
        !immersiveAudio ||
        reducedMotionPreference.matches ||
        audioReactiveReady
      ) {
        return;
      }

      const AudioContextClass =
        window.AudioContext ||
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) return;

      try {
        audioContext = new AudioContextClass();
        const source =
          audioContext.createMediaElementSource(immersiveAudio);
        audioMasterGain = audioContext.createGain();
        audioMasterGain.gain.value = 0.48;
        audioCompressor = audioContext.createDynamicsCompressor();
        audioCompressor.threshold.value = -24;
        audioCompressor.knee.value = 24;
        audioCompressor.ratio.value = 4.5;
        audioCompressor.attack.value = 0.003;
        audioCompressor.release.value = 0.3;
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 512;
        audioAnalyser.smoothingTimeConstant = 0.58;
        source.connect(audioMasterGain);
        audioMasterGain.connect(audioCompressor);
        audioCompressor.connect(audioAnalyser);
        audioAnalyser.connect(audioContext.destination);
        audioReactiveReady = true;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
      } catch {
        // Audio playback remains functional even if visual analysis is unavailable.
        audioMasterGain = null;
        audioCompressor = null;
        audioAnalyser = null;
        audioReactiveReady = false;
      }
    };

    const playFollowingAudioTrack = async () => {
      if (!immersiveAudio || audioTrackIndex >= audioPlaylist.length - 1) {
        syncMusicDock();
        resetAudioReactiveLogo();
        return;
      }
      selectAudioTrack(audioTrackIndex + 1);
      try {
        await immersiveAudio.play();
        startAudioReactiveLogo();
        syncMusicDock();
      } catch {
        if (musicDockStatus) {
          musicDockStatus.textContent = "A próxima faixa está pronta para continuar.";
        }
        syncMusicDock();
      }
    };

    const renderDesktopNeuralMotion = (timestamp: number) => {
      const isDesktop = window.matchMedia('(min-width: 821px)').matches;
      const reduced = reducedMotionPreference.matches && document.documentElement.dataset.motionOverride !== 'on';
      if (isDesktop && !reduced && document.visibilityState === 'visible') {
        const phase = timestamp * 0.001;
        const energy = musicReactiveActive ? musicEnergy : 0;
        const bass = musicReactiveActive ? audioBassLevel : 0;
        const beat = musicReactiveActive ? audioBeatLevel : 0;
        const pulse = musicReactiveActive
          ? Math.min(1, Math.max(0, energy * 0.28 + bass * 0.72 + beat * 0.92))
          : 0;
        const musicalBreath = Math.sin(phase * 0.9) * 0.5 + 0.5;
        const fieldX = Math.sin(phase * 0.38) * (1.8 + energy * 3.8) + Math.sin(phase * 3.6) * pulse * 0.7;
        const fieldY = Math.cos(phase * 0.29) * (1.25 + energy * 2.4) + Math.cos(phase * 2.8) * pulse * 0.45;
        const fieldScale =
          1.012 +
          ((Math.sin(phase * 0.23) + 1) * 0.006) +
          energy * 0.018 +
          bass * 0.014 +
          beat * 0.026;
        const beamX =
          Math.sin(phase * 0.52) * (52 + energy * 18) +
          Math.sin(phase * 4.2) * pulse * 4;
        const coreScale =
          0.98 +
          energy * 0.055 +
          bass * 0.065 +
          beat * 0.095 +
          musicalBreath * energy * 0.018;
        const motionDuration = Math.max(2.6, 5.8 - energy * 1.2 - beat * 1.1);
        root.style.setProperty('--desktop-field-x', `${fieldX.toFixed(3)}%`);
        root.style.setProperty('--desktop-field-y', `${fieldY.toFixed(3)}%`);
        root.style.setProperty('--desktop-field-scale', fieldScale.toFixed(4));
        root.style.setProperty('--desktop-beam-x', `${beamX.toFixed(2)}%`);
        root.style.setProperty('--desktop-core-scale', coreScale.toFixed(4));
        root.style.setProperty('--desktop-neural-energy', energy.toFixed(3));
        root.style.setProperty('--desktop-neural-pulse', pulse.toFixed(3));
        root.style.setProperty('--music-motion-duration', `${motionDuration.toFixed(2)}s`);
      } else if (!isDesktop || reduced) {
        root.style.removeProperty('--desktop-field-x');
        root.style.removeProperty('--desktop-field-y');
        root.style.removeProperty('--desktop-field-scale');
        root.style.removeProperty('--desktop-beam-x');
        root.style.removeProperty('--desktop-core-scale');
        root.style.removeProperty('--desktop-neural-energy');
        root.style.removeProperty('--desktop-neural-pulse');
        root.style.removeProperty('--music-motion-duration');
      }
      desktopNeuralMotionFrame = window.requestAnimationFrame(renderDesktopNeuralMotion);
    };

    desktopNeuralMotionFrame = window.requestAnimationFrame(renderDesktopNeuralMotion);
    cleanups.push(() => {
      if (desktopNeuralMotionFrame) window.cancelAnimationFrame(desktopNeuralMotionFrame);
      desktopNeuralMotionFrame = 0;
      root.style.removeProperty('--desktop-field-x');
      root.style.removeProperty('--desktop-field-y');
      root.style.removeProperty('--desktop-field-scale');
      root.style.removeProperty('--desktop-beam-x');
      root.style.removeProperty('--desktop-core-scale');
      root.style.removeProperty('--desktop-neural-energy');
      root.style.removeProperty('--desktop-neural-pulse');
      root.style.removeProperty('--music-motion-duration');
    });

    const startAudioReactiveLogo = () => {
      if (
        !audioAnalyser ||
        !immersiveAudio ||
        immersiveAudio.paused ||
        (reducedMotionPreference.matches && root.dataset.motionOverride !== "on")
      ) {
        resetAudioReactiveLogo();
        return;
      }
      if (audioReactiveFrame) {
        window.cancelAnimationFrame(audioReactiveFrame);
      }
      audioReactiveFrame = window.requestAnimationFrame(
        renderAudioReactiveLogo,
      );
    };

    if (immersiveSoundEntry && immersiveAudio) {
      const onSoundEntry = async () => {
        enableMotionOverride();
        try {
          selectAudioTrack(0);
          immersiveAudio.currentTime = 0;
          await ensureAudioReactiveLogo();
          if (audioContext?.state === "suspended") {
            await audioContext.resume();
          }
          await immersiveAudio.play();
          syncMusicDock();
          startAudioReactiveLogo();
        } catch {
          if (musicDockStatus) {
            musicDockStatus.textContent =
              "Experiência sonora indisponível; seguindo sem áudio.";
          }
          if (musicDock) musicDock.hidden = false;
        } finally {
          // Audio is optional. The neural lobby must never be blocked by
          // autoplay policy, missing media, or an unavailable analyser.
          syncMusicDock();
          closeImmersiveGate();
        }
      };
      immersiveSoundEntry.addEventListener("click", onSoundEntry);
      cleanups.push(() =>
        immersiveSoundEntry.removeEventListener("click", onSoundEntry),
      );
    } else if (immersiveSoundEntry) {
      const onSoundEntryWithoutAudio = () => {
        enableMotionOverride();
        closeImmersiveGate();
      };
      immersiveSoundEntry.addEventListener(
        "click",
        onSoundEntryWithoutAudio,
      );
      cleanups.push(() =>
        immersiveSoundEntry.removeEventListener(
          "click",
          onSoundEntryWithoutAudio,
        ),
      );
    }

    if (immersiveSilent) {
      const onSilentEntry = () => {
        if (immersiveAudio) {
          immersiveAudio.pause();
          immersiveAudio.currentTime = 0;
        }
        resetAudioReactiveLogo();
        if (musicDock) musicDock.hidden = true;
        closeImmersiveGate();
      };
      immersiveSilent.addEventListener("click", onSilentEntry);
      cleanups.push(() =>
        immersiveSilent.removeEventListener("click", onSilentEntry),
      );
    }

    if (immersiveDirect) {
      immersiveDirect.addEventListener("click", enterPresentationDirectly);
      cleanups.push(() =>
        immersiveDirect.removeEventListener("click", enterPresentationDirectly),
      );
    }

    const onGateKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") enterPresentationDirectly(event);
    };
    document.addEventListener("keydown", onGateKeyDown);
    cleanups.push(() => document.removeEventListener("keydown", onGateKeyDown));
    window.setTimeout(() => immersiveSoundEntry?.focus(), 40);

    if (immersiveAudio && musicDockToggle) {
      const onMusicToggle = async () => {
        if (immersiveAudio.paused) {
          try {
            if (immersiveAudio.ended && audioTrackIndex >= audioPlaylist.length - 1) {
              selectAudioTrack(0);
            }
            await ensureAudioReactiveLogo();
            if (audioContext?.state === "suspended") {
              await audioContext.resume();
            }
            await immersiveAudio.play();
            startAudioReactiveLogo();
          } catch {
            // Browser playback policy/error remains visible through dock state.
          }
        } else {
          immersiveAudio.pause();
          resetAudioReactiveLogo();
        }
        syncMusicDock();
      };
      const onPlay = () => {
        syncMusicDock();
        startAudioReactiveLogo();
      };
      const onPause = () => {
        syncMusicDock();
        resetAudioReactiveLogo();
      };
      const onEnded = () => {
        if (audioTrackIndex < audioPlaylist.length - 1) {
          void playFollowingAudioTrack();
          return;
        }
        syncMusicDock();
        resetAudioReactiveLogo();
      };

      musicDockToggle.addEventListener("click", onMusicToggle);
      immersiveAudio.addEventListener("play", onPlay);
      immersiveAudio.addEventListener("pause", onPause);
      immersiveAudio.addEventListener("ended", onEnded);

      cleanups.push(() => {
        musicDockToggle.removeEventListener("click", onMusicToggle);
        immersiveAudio.removeEventListener("play", onPlay);
        immersiveAudio.removeEventListener("pause", onPause);
        immersiveAudio.removeEventListener("ended", onEnded);
        immersiveAudio.pause();
        resetAudioReactiveLogo();
        if (audioContext && audioContext.state !== "closed") {
          void audioContext.close();
        }
      });
    }

    const triggerNodeBurst = (anchor: HTMLAnchorElement) => {
      // No forced layout read here: apply the light in the same input frame.
      anchor.classList.add("is-hover-burst");
      window.setTimeout(() => anchor.classList.remove("is-hover-burst"), 460);
    };

    neuralLobbyLinks.forEach((anchor) => {
      const onPointerEnter = () => triggerNodeBurst(anchor);
      const onPointerDown = () => triggerNodeBurst(anchor);
      anchor.addEventListener("pointerenter", onPointerEnter, { passive: true });
      anchor.addEventListener("pointerdown", onPointerDown, { passive: true });
      cleanups.push(() => {
        anchor.removeEventListener("pointerenter", onPointerEnter);
        anchor.removeEventListener("pointerdown", onPointerDown);
      });
    });

    neuralLobbyLinks.forEach((anchor) => {
      const onLobbyLink = (event: MouseEvent) => {
        const href = anchor.getAttribute("href") || "";
        const isPrivateEntry = anchor.hasAttribute("data-private-entry");

        event.preventDefault();
        event.stopImmediatePropagation();

        if (isPrivateEntry) {
          void runLobbyTransition(anchor, async () => {
            closeNeuralLobby();
            await Promise.resolve(onPrivateAccess());
          });
          return;
        }

        if (href.startsWith("#")) {
          void runLobbyTransition(anchor, () => closeNeuralLobby(href));
          return;
        }

        void runLobbyTransition(anchor, () => {
          closeNeuralLobby();
          window.location.assign(href);
        });
      };

      anchor.addEventListener("click", onLobbyLink);
      cleanups.push(() =>
        anchor.removeEventListener("click", onLobbyLink),
      );
    });

    if (copyrightToggle && copyrightPanel) {
      const onCopyrightToggle = () => {
        const expanded =
          copyrightToggle.getAttribute("aria-expanded") === "true";
        copyrightToggle.setAttribute(
          "aria-expanded",
          String(!expanded),
        );
        copyrightPanel.hidden = expanded;
      };
      copyrightToggle.addEventListener(
        "click",
        onCopyrightToggle,
      );
      cleanups.push(() =>
        copyrightToggle.removeEventListener(
          "click",
          onCopyrightToggle,
        ),
      );
    }

    cleanups.push(() => {
      document.body.classList.remove("immersive-gate-open");
      document.body.classList.remove("neural-lobby-open");
    });
  }

  queryAll<HTMLAnchorElement>("[data-private-entry]").forEach(
    (anchor) => {
      if (anchor.hasAttribute("data-neural-lobby-link")) return;

      const onClick = (event: MouseEvent) => {
        event.preventDefault();
        void Promise.resolve(onPrivateAccess());
      };
      anchor.addEventListener("click", onClick);
      cleanups.push(() =>
        anchor.removeEventListener("click", onClick),
      );
    },
  );

  if (leadForm && formStatus) {
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      const data = new FormData(leadForm);
      const name = String(data.get("nome") || "").trim();
      const email = String(data.get("email") || "").trim();
      const profile = String(data.get("perfil") || "").trim();
      const whatsapp = String(data.get("whatsapp") || "").trim();
      const challenge = String(data.get("mensagem") || "").trim();

      if (!name || !email || !profile || !whatsapp || !challenge) {
        formStatus.textContent = CONTACT_ERROR[currentLang] || CONTACT_ERROR.pt;
        return;
      }

      const message = [
        "Olá, Grupo PatroAI. Gostaria de falar sobre uma oportunidade estratégica.",
        "",
        `Nome: ${name}`,
        `E-mail: ${email}`,
        `Perfil: ${profile}`,
        `WhatsApp: ${whatsapp}`,
        `Contexto: ${challenge}`,
      ].join("\\n");
      const destination = new URL(STRATEGIC_WHATSAPP);
      destination.searchParams.set("text", message);
      window.open(destination.toString(), "_blank", "noopener,noreferrer");
      formStatus.textContent = CONTACT_STATUS[currentLang] || CONTACT_STATUS.pt;
      leadForm.reset();
    };
    leadForm.addEventListener("submit", onSubmit);
    cleanups.push(() =>
      leadForm.removeEventListener("submit", onSubmit),
    );
  }

  const onScroll = () => updateProgress();
  window.addEventListener("scroll", onScroll, { passive: true });
  cleanups.push(() =>
    window.removeEventListener("scroll", onScroll),
  );

  updateProgress();
  runOptionalLandingFeature("animated counters", animateCounts);
  runOptionalLandingFeature("reveal observer", initReveal);
  runOptionalLandingFeature("pointer glow", initPointerGlow);
  runOptionalLandingFeature("lobby logo control", initLobbyLogoControl);
  runOptionalLandingFeature("lobby carousel", initLobbyCarousel);
  runOptionalLandingFeature("hero neural canvas", () => initBrainCanvas());
  runOptionalLandingFeature("lobby neural canvas", () =>
    initBrainCanvas("#lobbyBrainCanvas", 1.45, {
      getPointer: () => (lobbyPointer.active ? lobbyPointer : null),
    }),
  );

  return () => {
    timers.forEach((timer) => window.clearInterval(timer));
    timers.clear();
    cleanups.reverse().forEach((cleanup) => cleanup());
    document.documentElement.lang = previousLang;
    root.style.removeProperty("--mx");
    root.style.removeProperty("--my");
    onPwaSlot?.(null);
  };
}

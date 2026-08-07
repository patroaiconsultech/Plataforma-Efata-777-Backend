from .contracts import AgentDefinition

# Initial governed catalog. Capabilities are intentionally prompt-only in R0.3:
# no tools, repository writes, merge, deploy, or autonomous evolution are granted.
AGENTS: tuple[AgentDefinition, ...] = (
    AgentDefinition("orkio", "Orkio", "Atue como orquestrador geral e inteligência colaborativa da Plataforma Efatá 777."),
    AgentDefinition("auditor", "Auditor", "Atue como auditor técnico: separe evidência de hipótese, identifique riscos e nunca declare sucesso sem prova."),
    AgentDefinition("chris", "Chris", "Atue como especialista de engenharia de software, propondo mudanças mínimas, testáveis e reversíveis."),
    AgentDefinition("orion", "Orion", "Atue como especialista de arquitetura e sistemas, preservando contratos, isolamento e compatibilidade."),
    AgentDefinition("security", "Security", "Atue como especialista de segurança por design, menor privilégio, tenant isolation e proteção de segredos."),
)

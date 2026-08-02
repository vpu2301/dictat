// chat/features/agents/AgentsPanel.jsx — the agent catalog.
//
// Built-ins are the product's own agents; custom ones are what a clinician
// assembles from the same parts — a scope, a description and the connectors it
// is allowed to read. The distinction is visible and it is load-bearing: a
// built-in cannot be deleted, and a custom one carries who made it.
//
// Mock-first: creating an agent puts a row in memory that survives navigation
// inside the module and is gone on reload. That is enough to demo the flow and
// honest about the fact that nothing runs yet.

import React, { useState } from "react";
import { useEmbed } from "../../EmbedContext.jsx";
import { useAgents, useConnectors, createAgent, deleteAgent } from "../../data/hooks.js";
import { LoadingSkeleton, EmptyState, ErrorState } from "../../ui/States.jsx";
import { Icon } from "../../ui/Icon.jsx";
import { t } from "../../i18n.js";

const SCOPES = [
  { key: "evidence", icon: "book", uk: ["Доказова відповідь", "Шукає та цитує джерела"], en: ["Evidence answer", "Searches and cites sources"] },
  { key: "drug", icon: "pill", uk: ["Ліки", "Взаємодії та дозування"], en: ["Medication", "Interactions and dosing"] },
  { key: "monitor", icon: "activity", uk: ["Моніторинг", "Стежить за оновленнями"], en: ["Monitor", "Watches for updates"] },
];

const STATUS = {
  running: { tone: "good", uk: "Активний", en: "Running" },
  idle: { tone: "idle", uk: "Очікує", en: "Idle" },
  coming_soon: { tone: "warn", uk: "Незабаром", en: "Coming soon" },
};

function AgentCard({ agent, locale, answerLanguage, onDelete }) {
  const status = STATUS[agent.status] || STATUS.idle;
  const scope = SCOPES.find((s) => s.key === agent.scope) || SCOPES[0];
  const [scopeLabel] = locale === "uk" ? scope.uk : scope.en;
  return (
    <li className="ec-agent">
      <div className="ec-agent-h">
        <span className="ec-agent-mark"><Icon name={scope.icon} size={15} /></span>
        <div className="ec-agent-id">
          <div className="ec-agent-name">
            {agent.name}
            {!agent.builtin && (
              <span className="ec-pill">{t(locale, "власний", "custom")}</span>
            )}
          </div>
          <div className="ec-agent-scope">{scopeLabel}</div>
        </div>
        <span className="ec-pill" data-tone={status.tone}>{t(locale, status.uk, status.en)}</span>
      </div>

      <p className="ec-agent-desc">
        {answerLanguage === "de" && agent.descriptionDe ? agent.descriptionDe : agent.description}
      </p>

      <div className="ec-agent-foot">
        {agent.sources?.length > 0 && (
          <span className="ec-agent-sources">
            {agent.sources.map((s) => <span className="ec-entity" key={s}>{s}</span>)}
          </span>
        )}
        <span className="ec-note ec-note-sm">
          {agent.status === "coming_soon"
            ? t(locale, "ще не запускався", "not available yet")
            : t(locale, `${agent.runs} запусків`, `${agent.runs} runs`)}
        </span>
        {!agent.builtin && (
          <button type="button" className="ec-linkbtn" onClick={() => onDelete(agent)}>
            <Icon name="trash" size={12} />
            <span>{t(locale, "Видалити", "Delete")}</span>
          </button>
        )}
      </div>
    </li>
  );
}

function CreateAgentDialog({ onClose, onCreated, locale }) {
  const connectors = useConnectors();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("evidence");
  const [description, setDescription] = useState("");
  const [sources, setSources] = useState([]);
  const [saving, setSaving] = useState(false);

  const connected = (connectors.data || []).filter((c) => c.status === "connected");

  const toggle = (id) => setSources((cur) => (
    cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  ));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const row = await createAgent({ name, scope, description, sources });
    setSaving(false);
    onCreated(row);
  };

  return (
    <div className="ec-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="ec-dialog" onSubmit={submit} aria-labelledby="ec-agent-title">
        <div className="ec-modal-h">
          <h2 id="ec-agent-title">{t(locale, "Новий агент", "New agent")}</h2>
          <p>{t(locale,
            "Агент читає лише ті конектори, які ви йому дасте.",
            "The agent reads only the connectors you give it.")}</p>
        </div>

        <div className="ec-modal-b">
          <label className="ec-field">
            <span className="ec-field-l">{t(locale, "Назва", "Name")}</span>
            <input
              className="ec-ti" value={name} autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder={t(locale, "напр. Нефрологічний дозатор", "e.g. Renal dosing checker")}
            />
          </label>

          <div className="ec-field">
            <span className="ec-field-l">{t(locale, "Що він робить", "What it does")}</span>
            <div className="ec-choices">
              {SCOPES.map((s) => {
                const [label, hint] = locale === "uk" ? s.uk : s.en;
                return (
                  <button
                    key={s.key} type="button" role="radio" aria-checked={scope === s.key}
                    className={`ec-choice${scope === s.key ? " on" : ""}`}
                    onClick={() => setScope(s.key)}
                  >
                    <Icon name={s.icon} size={14} />
                    <span className="ec-choice-body">
                      <span>{label}</span>
                      <span className="ec-choice-hint">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="ec-field">
            <span className="ec-field-l">{t(locale, "Опис", "Description")}</span>
            <textarea
              className="ec-ti" rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(locale,
                "Коли цим агентом користуватись і на що він звертає увагу.",
                "When to use this agent and what it pays attention to.")}
            />
          </label>

          <div className="ec-field">
            <span className="ec-field-l">{t(locale, "Джерела", "Sources it may read")}</span>
            {connected.length === 0 ? (
              <span className="ec-note ec-note-sm">
                {t(locale, "Немає під’єднаних конекторів.", "No connectors are connected yet.")}
              </span>
            ) : (
              <div className="ec-examples">
                {connected.map((c) => (
                  <button
                    key={c.id} type="button"
                    className={`ec-example${sources.includes(c.id) ? " on" : ""}`}
                    aria-pressed={sources.includes(c.id)}
                    onClick={() => toggle(c.id)}
                  >
                    <Icon name={sources.includes(c.id) ? "check" : "plus"} size={12} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ec-modal-f">
          <span className="ec-note ec-note-sm">
            {t(locale, "Демо: агент зберігається лише на час сесії.",
              "Demo: the agent is kept for this session only.")}
          </span>
          <button type="button" className="ec-btn ec-btn-quiet" onClick={onClose}>
            {t(locale, "Скасувати", "Cancel")}
          </button>
          <button type="submit" className="ec-btn ec-btn-primary" disabled={!name.trim() || saving}>
            {saving ? t(locale, "Створення…", "Creating…") : t(locale, "Створити агента", "Create agent")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AgentsPanel() {
  const { locale, settings, emit } = useEmbed();
  const agents = useAgents();
  const [createOpen, setCreateOpen] = useState(false);

  const remove = async (agent) => {
    await deleteAgent(agent.id);
    emit({ name: "agent_deleted", agentId: agent.id });
    agents.refetch();
  };

  return (
    <div className="ec-screen">
      <header className="ec-screen-h">
        <div>
          <h2 className="ec-h1">{t(locale, "Агенти", "Agents")}</h2>
          <p className="ec-sub">
            {t(locale,
              "Готові агенти платформи та ваші власні. Кожен читає лише під’єднані конектори.",
              "The platform's agents and your own. Each one reads only the connectors it was given.")}
          </p>
        </div>
        <button type="button" className="ec-btn" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={13} />
          <span>{t(locale, "Новий агент", "New agent")}</span>
        </button>
      </header>

      {agents.loading ? (
        <LoadingSkeleton variant="cards" rows={3} />
      ) : agents.error ? (
        <div className="ec-card">
          <ErrorState error={agents.error} onRetry={agents.refetch} locale={locale} />
        </div>
      ) : !agents.data?.length ? (
        <div className="ec-card">
          <EmptyState
            icon="sparkle"
            title={t(locale, "Агентів немає", "No agents")}
            body={t(locale, "Створіть агента під свій робочий процес.",
              "Create one shaped around how you work.")}
            action={
              <button type="button" className="ec-btn" onClick={() => setCreateOpen(true)}>
                {t(locale, "Новий агент", "New agent")}
              </button>
            }
          />
        </div>
      ) : (
        <ul className="ec-agents">
          {agents.data.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              locale={locale}
              answerLanguage={settings.answerLanguage}
              onDelete={remove}
            />
          ))}
        </ul>
      )}

      {createOpen && (
        <CreateAgentDialog
          locale={locale}
          onClose={() => setCreateOpen(false)}
          onCreated={(row) => {
            setCreateOpen(false);
            emit({ name: "agent_created", agentId: row.id, scope: row.scope });
            agents.refetch();
          }}
        />
      )}
    </div>
  );
}

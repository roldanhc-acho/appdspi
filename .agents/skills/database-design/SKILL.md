---
name: database-design
description: Database design principles and decision-making. Schema design, indexing strategy, ORM selection, serverless databases.
when_to_use: "When designing database schemas, choosing ORMs, planning migrations, or optimizing queries. When working with Prisma, Drizzle, or SQL files."
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0.0
---

# Database Design

> **Learn to THINK, not copy SQL patterns.**

## 🎯 Selective Reading Rule

**Read ONLY files relevant to the request!** Check the content map, find what you need.

| File | Description | When to Read |
|------|-------------|--------------|
| `database-selection.md` | Selección de almacenamiento: SSOT offline (Room/OPFS), RLS InitPlan, Cloud (PG/Supabase/Firebase) y Ledgers HMAC | Elegir motor y arquitectura de persistencia |
| `orm-selection.md` | Selección de cliente/ORM: Room (SSOT), Drizzle, Kysely, Prisma, SQLAlchemy y aislamiento FCIS | Elección de ORM, driver y mapper de datos |
| `schema-design.md` | Normalization, PKs, relationships | Designing schema |
| `indexing.md` | Tipos de índices, optimización RLS InitPlan, cursores O(1), ledgers HMAC y EXPLAIN ANALYZE | Performance tuning & RLS indexing |
| `optimization.md` | Diagnóstico N+1, banderas rojas en EXPLAIN ANALYZE, optimización RLS InitPlan y paginación por cursor O(1) | Query optimization & execution profiling |
| `migrations.md` | Safe migrations, serverless DBs | Schema changes |

---

## ⚠️ Core Principle

- ASK user for database preferences when unclear
- Choose database/ORM based on CONTEXT
- Don't default to PostgreSQL for everything

---

## Decision Checklist

Before designing schema:

- [ ] Asked user about database preference?
- [ ] Chosen database for THIS context?
- [ ] Considered deployment environment?
- [ ] Planned index strategy?
- [ ] Defined relationship types?

---

## Anti-Patterns

❌ Default to PostgreSQL for simple apps (SQLite may suffice)
❌ Skip indexing
❌ Use SELECT * in production
❌ Store JSON when structured data is better
❌ Ignore N+1 queries

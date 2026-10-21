# Openfront Convenience

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-convenience&env=DATABASE_URL%2CSESSION_SECRET)

Openfront Convenience is a self-hostable convenience-store retail and operations application. Customers can browse a local catalog and prepare a basket, while staff manage POS, registers, cash, pricing, purchasing, inventory, prepared food, restricted sales, reconciliation, and reporting.

## Demo

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-convenience)

[Documentation →](https://docs.openship.org/docs/openfront/convenience/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Convenience**: (This repository) a self-hostable convenience-store retail and operations application.

## Core Features

### Admin Dashboard
Manage platform through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
The local shopping surface includes `/shop`, product detail, `/basket`, `/checkout`, and `/account`. Catalog publication and checkout operate alongside the store's product, stock, and restricted-sale rules.

### Store Retail & Cash
Manage POS sales, tenders, refunds, registers, shifts, cash movements, store-day records, bank deposits, and reconciliation.

### Catalog, Purchasing & Inventory
Maintain products, variants, barcodes, tax categories, price books, promotions, loyalty, vendors, purchase orders, receiving, lots, counts, transfers, and waste.

### Specialized Store Operations
Dedicated workspaces cover prepared food, restricted sales, fuel, lottery, money services, exports, exceptions, and recovery. Provider and hardware activation require separate operator configuration; these workspaces are not certifications for regulated services.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-convenience/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Businesses, employees, roles, stores, registers, sessions, and shifts.
- Products, variants, barcodes, pricing, taxes, promotions, and loyalty.
- Inventory lots, ledgers, counts, transfers, vendors, purchasing, and receiving.
- Sales, tenders, refunds, cash movements, reconciliation, prepared food, fuel, and operational events.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-convenience.git
   cd openfront-convenience
   npm install
   ```

2. **Configure environment variables:**
   Create a local `.env` file using the [runtime configuration](features/keystone/index.ts) as the authority.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/index.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The development script prepares the backend schema, applies checked-in migrations, and starts Next.js.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Provision the first approved administrator with `npm run bootstrap:admin`, following the owner-approval and credential requirements in [the bootstrap script](scripts/bootstrapProductionAdmin.ts). The ordinary `/dashboard/init` flow is development-only and explicitly gated.

6. **Run application onboarding:**
   After administrator bootstrap, run business onboarding and review stores, employees, registers, catalog, pricing, and permitted operating capabilities.

## Development Commands

- `npm run dev` - Prepare the backend schema, apply migrations, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Start the production Next.js server.
- `npm run migrate:gen` - Run the guarded disposable-database migration generator; review its approval and database requirements first.
- `npm run migrate` - Run migration preflight, apply checked-in migrations, and check post-migration integrity.
- `npm run lint` - Run the repository's ESLint script.
- `npm run typecheck` - Run the configured TypeScript check.
- `npm run test` - Run the repository's configured test suite.
- `npm run bootstrap:admin` - Run the owner-approved first-administrator bootstrap.
- `npm run worker:outbox` - Run the configured outbox delivery entry point.
- `npm run worker:alerts` - Run operational alert processing.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Operational Delivery
The registered [workflow commands](features/keystone/mutations/index.ts) cover payment events, integrations, restricted sales, offline replay, and operational recovery. Run outbox and alert workers separately when those workflows are enabled.

## Documentation

See the [Openfront Convenience documentation](https://docs.openship.org/docs/openfront/convenience/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageCatalog` - Manage catalog.
- `canManageInventory` - Manage inventory.
- `canManageSales` - Manage sales.
- `canManageCash` - Manage cash.
- `canManagePurchasing` - Manage purchasing.
- `canManageCompliance` - Manage compliance.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Employee permissions are tied to an active business, business-owned role, and permitted stores. Platform administrators require explicit approval; machine credentials narrow access by business, store, and scope.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Platform**: `/dashboard/platform`.

### Storefront Experience
The local shopping surface includes `/shop`, product detail, `/basket`, `/checkout`, and `/account`. Catalog publication and checkout operate alongside the store's product, stock, and restricted-sale rules.

Manage POS sales, tenders, refunds, registers, shifts, cash movements, store-day records, bank deposits, and reconciliation.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

### Scaling Considerations
Schedule `npm run worker:outbox` and `npm run worker:alerts` for enabled delivery and alert workflows. Preserve business/store scope across processes and review offline replay and reconciliation before adding registers.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

No top-level license file or package license declaration is included in this repository.

## Support

- **Documentation**: [Openfront Convenience guide](https://docs.openship.org/docs/openfront/convenience/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-convenience/issues).
- **Product**: [Learn more about Openfront Convenience](https://openship.org/products/openfront-convenience).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).

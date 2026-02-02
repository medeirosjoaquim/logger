# Contributing to Universal Logger

Thank you for your interest in contributing to Universal Logger! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/logger.git
   cd logger
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🛠️ Development

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with coverage
npm test -- --coverage
```

### Building

```bash
# Build the project
npm run build

# Build in watch mode
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Running Examples

```bash
npm run example:simple
```

## 📝 Code Style

- Use TypeScript for all new code
- Follow existing code style (enforced by ESLint)
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

### Commit Messages

Follow conventional commits format:

```
feat: add new feature
fix: fix bug
docs: update documentation
test: add tests
refactor: refactor code
chore: update dependencies
```

## 🧪 Testing

- Write tests for all new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage
- Test files should be colocated with source files or in `src/__tests__`

## 📚 Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/)
- Add examples for new features

## 🔄 Pull Request Process

1. **Before submitting:**
   - Run tests: `npm run test:run`
   - Run type check: `npm run typecheck`
   - Build: `npm run build`
   - Update documentation

2. **PR Description:**
   - Describe what changes you made
   - Link related issues
   - Add screenshots for UI changes
   - List breaking changes (if any)

3. **Review Process:**
   - Maintainers will review your PR
   - Address feedback and requested changes
   - Once approved, your PR will be merged

## 🐛 Reporting Bugs

When reporting bugs, please include:

- Universal Logger version
- Browser/Node.js version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Code sample (if applicable)
- Error messages/stack traces

## 💡 Feature Requests

We welcome feature requests! Please:

- Check if the feature already exists
- Describe the use case
- Explain why it would be useful
- Provide examples if possible

## 📋 Project Structure

```
logger/
├── src/
│   ├── core/           # Core logger functionality
│   ├── tracing/        # Distributed tracing
│   ├── storage/        # Storage providers
│   ├── transport/      # Event transport
│   ├── integrations/   # Sentry integrations
│   ├── ui/            # React components
│   ├── types/         # TypeScript types
│   └── __tests__/     # Test files
├── examples/          # Example applications
├── dist/             # Built files (generated)
└── scripts/          # Build/utility scripts
```

## 🎯 Areas for Contribution

- **Integrations:** Add support for more frameworks/libraries
- **Storage Providers:** Implement new storage backends
- **Documentation:** Improve docs and examples
- **Tests:** Increase test coverage
- **Performance:** Optimize critical paths
- **Bug Fixes:** Fix reported issues

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn and grow

## 💬 Questions?

- Open a [GitHub Discussion](https://github.com/asari/logger/discussions)
- Check existing [Issues](https://github.com/asari/logger/issues)
- Read the [Documentation](https://github.com/asari/logger/wiki)

---

Thank you for contributing to Universal Logger! 🎉

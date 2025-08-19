# Contributing to TagFusion

Thank you for your interest in contributing to TagFusion! 🎉

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Windows 10/11 (for testing)
- Git

### Setup Development Environment
```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/TagFusion.git
cd TagFusion

# Install dependencies
npm install

# Start development server
npm start
```

## 🛠️ Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b bugfix/issue-description
```

### 2. Make Changes
- Follow the existing code style
- Add JSDoc comments for new functions
- Test your changes thoroughly
- Update documentation if needed

### 3. Test Your Changes
```bash
# Run the app in development
npm start

# Build and test the portable version
npm run build
```

### 4. Commit Your Changes
```bash
git add .
git commit -m "feat: add amazing new feature"
# or
git commit -m "fix: resolve issue with tag saving"
```

### 5. Push and Create PR
```bash
git push origin feature/your-feature-name
```
Then create a Pull Request on GitHub.

## 📝 Code Style Guidelines

### JavaScript
- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable names
- Add JSDoc comments for functions
- Keep functions small and focused

### HTML/CSS
- Use semantic HTML elements
- Follow BEM naming convention for CSS classes
- Use CSS custom properties for theming
- Ensure responsive design

### File Structure
```
TagFusion/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── index.html           # Main UI
├── app.js               # Frontend logic
├── styles.css           # Styling
├── Assets/              # Static assets
└── data/                # Portable data
```

## 🐛 Bug Reports

When reporting bugs, please include:
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Console error messages

## 💡 Feature Requests

For new features, please:
- Check existing issues first
- Describe the use case
- Explain why it would be valuable
- Consider implementation complexity

## 🏷️ Commit Message Format

Use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

## 📋 Pull Request Checklist

- [ ] Code follows the style guidelines
- [ ] Self-review completed
- [ ] Changes tested on Windows
- [ ] Documentation updated if needed
- [ ] No console errors or warnings
- [ ] Portable build works correctly

## 🤝 Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Keep discussions on-topic

## 📞 Questions?

Feel free to:
- Open an issue for discussion
- Contact @BassBoost1981 on GitHub
- Check existing documentation

Thank you for contributing! 🙏

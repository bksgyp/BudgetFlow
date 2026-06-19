module.exports = {
  apps: [
    {
      name: 'budgetflow-llm',
      script: 'node_modules/.bin/tsx',
      args: 'src/app.ts',
      cwd: __dirname,
    },
  ],
};

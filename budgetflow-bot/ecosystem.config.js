module.exports = {
  apps: [
    {
      name: 'budgetflow-bot',
      script: 'src/app.ts',
      interpreter: 'node',
      interpreter_args: '-r ts-node/register',
      cwd: __dirname,
    },
  ],
};

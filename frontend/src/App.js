import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, CheckCircle2, BookOpen, AlertCircle, Loader2, Key, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

function App() {
  const [goals, setGoals] = useState(() => {
    const savedGoals = localStorage.getItem('goals');
    return savedGoals ? JSON.parse(savedGoals) : [];
  });
  const [newGoal, setNewGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [showApiInput, setShowApiInput] = useState(!localStorage.getItem('openai_api_key'));
  const [collapsedGoals, setCollapsedGoals] = useState(() => {
    const saved = localStorage.getItem('collapsedGoals');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('collapsedGoals', JSON.stringify(collapsedGoals));
  }, [collapsedGoals]);

  const toggleGoal = (goalId) => {
    setCollapsedGoals(prev => ({
      ...prev,
      [goalId]: !prev[goalId]
    }));
  };

  const showMessage = (message, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess('');
    } else {
      setSuccess(message);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  };

  const saveApiKey = () => {
    if (!apiKey.trim()) {
      showMessage('Please enter your OpenAI API key', true);
      return;
    }
    localStorage.setItem('openai_api_key', apiKey);
    setShowApiInput(false);
    showMessage('API key saved successfully!');
  };

  const resetApiKey = () => {
    localStorage.removeItem('openai_api_key');
    setApiKey('');
    setShowApiInput(true);
  };

  const addGoal = () => {
    if (!newGoal.trim()) {
      showMessage('Please enter a goal description', true);
      return;
    }
    
    const goalId = Date.now().toString();
    const newGoalObj = {
      id: goalId,
      description: newGoal,
      createdAt: new Date().toISOString(),
    };
    
    setGoals(prevGoals => [...prevGoals, newGoalObj]);
    setNewGoal('');
    showMessage('Goal added successfully!');
  };

  const getAIGuidance = async (goalId) => {
    if (!apiKey) {
      showMessage('Please set your OpenAI API key first', true);
      setShowApiInput(true);
      return;
    }

    setLoading(true);
    const goal = goals.find(g => g.id === goalId);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo", // Using GPT-3.5 for faster response
          messages: [
            {
              role: "system",
              content: `You are an AI goal coach. Break down the goal into actionable steps and suggest relevant resources. Use markdown formatting for emphasis and structure. Format your response exactly as shown:

# Steps:
1. **First Step**: Detailed explanation with *emphasis* where needed
2. **Second Step**: Clear instructions with potential **key points**
3. **Third Step**: Step description with practical advice
(Continue with up to 5 steps)

# Resources:
- **Resource 1**: Brief description of how this resource helps
- **Resource 2**: Explanation of resource's value
- **Resource 3**: How this resource supports the goal

Note: Use markdown formatting for emphasis (*italic*) and **bold** text. Keep responses concise but informative.`
            },
            {
              role: "user",
              content: `Help me achieve this goal: ${goal.description}. Please provide a concise response with up to 5 steps and 3 resources.`
            }
          ],
          max_tokens: 500, // Limiting response size
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to get AI guidance. Please check your API key.');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse the response
      const steps = [];
      const resources = [];
      
      if (content.includes('# Steps:')) {
        const parts = content.split('# Steps:');
        const stepsSection = parts[1].split('# Resources:')[0];
        steps.push(...stepsSection.split('\n')
          .map(step => step.trim())
          .filter(step => step && !step.startsWith('#') && !step.startsWith('-')));
      }

      if (content.includes('# Resources:')) {
        const resourcesSection = content.split('# Resources:')[1];
        resources.push(...resourcesSection.split('\n')
          .map(resource => ({
            title: resource.trim(),
            url: '#'
          }))
          .filter(resource => resource.title && resource.title.startsWith('-')));
      }

      setGoals(prevGoals => prevGoals.map(g => 
        g.id === goalId 
          ? { ...g, steps, resources }
          : g
      ));
      showMessage('AI guidance generated successfully!');
    } catch (error) {
      showMessage(error.message, true);
    }
    setLoading(false);
  };

  const deleteGoal = (goalId) => {
    setGoals(prevGoals => prevGoals.filter(goal => goal.id !== goalId));
    showMessage('Goal deleted successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="container mx-auto px-4 py-12">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center mb-4">
            <Target className="w-12 h-12 text-primary-600 mr-4" />
            <h1 className="text-5xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-800">
              AI Goal Coach
            </h1>
          </div>
          <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
            Your intelligent companion for breaking down goals into actionable steps
          </p>
        </motion.header>

        <AnimatePresence>
          {(error || success) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`max-w-2xl mx-auto mb-8 p-4 rounded-xl shadow-soft-md flex items-center ${
                error ? 'bg-red-50' : 'bg-green-50'
              }`}
            >
              {error ? (
                <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-3" />
              )}
              <p className={error ? 'text-red-700' : 'text-green-700'}>
                {error || success}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          {showApiInput ? (
            <div className="bg-white rounded-2xl shadow-soft-xl p-8 mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center">
                <Key className="w-6 h-6 mr-2 text-primary-600" />
                Set Your OpenAI API Key
              </h2>
              <div className="flex gap-4">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key..."
                  className="flex-1 p-4 border-2 border-secondary-200 rounded-xl text-secondary-800 placeholder-secondary-400 focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
                />
                <button
                  onClick={saveApiKey}
                  className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-semibold shadow-soft-md hover:shadow-soft-xl"
                >
                  Save Key
                </button>
              </div>
              <p className="mt-4 text-sm text-secondary-600">
                Your API key is stored locally and never sent to any server.
              </p>
            </div>
          ) : (
            <div className="text-right mb-4">
              <button
                onClick={resetApiKey}
                className="text-sm text-secondary-600 hover:text-secondary-800"
              >
                Reset API Key
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-soft-xl p-8 mb-8">
            <div className="flex gap-4 mb-8">
              <textarea
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="What's your next big goal? You can use markdown formatting."
                className="flex-1 p-4 border-2 border-secondary-200 rounded-xl text-secondary-800 placeholder-secondary-400 focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all min-h-[100px] resize-y"
                disabled={loading}
              />
              <button
                onClick={addGoal}
                disabled={loading}
                className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 font-semibold shadow-soft-md hover:shadow-soft-xl"
              >
                Add Goal
              </button>
            </div>

            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />
                  <p className="mt-4 text-secondary-600">Getting AI guidance...</p>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout className="space-y-6">
              {goals.map((goal) => (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-secondary-50 rounded-xl p-6 border border-secondary-100 hover:shadow-soft-md transition-all"
                >
                  <div 
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleGoal(goal.id)}
                  >
                    <div className="flex items-start flex-1 mr-4">
                      <div className="flex items-center mr-2 mt-1.5">
                        {collapsedGoals[goal.id] ? (
                          <ChevronRight className="w-5 h-5 text-secondary-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-secondary-500" />
                        )}
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="text-xl font-semibold text-secondary-900"
                          components={{
                            p: ({node, ...props}) => <p className="my-0" {...props} />,
                            a: ({node, children, ...props}) => (
                              <a 
                                className="text-primary-600 hover:text-primary-800" 
                                {...props}
                                aria-label={typeof children === 'string' ? children : 'Link'}
                                role="link"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {goal.description}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {!goal.steps && (
                        <button
                          onClick={() => getAIGuidance(goal.id)}
                          disabled={loading}
                          className="flex items-center px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Target className="w-4 h-4 mr-2" />
                          )}
                          Get AI Guidance
                        </button>
                      )}
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {!collapsedGoals[goal.id] && goal.steps && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-6">
                          <div className="flex items-center text-secondary-800 mb-3">
                            <CheckCircle2 className="w-5 h-5 mr-2 text-primary-600" />
                            <h4 className="font-semibold">Action Steps</h4>
                          </div>
                          <div className="space-y-2">
                            {goal.steps.map((step, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start"
                              >
                                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-medium mr-3 flex-shrink-0 mt-1">
                                  {index + 1}
                                </span>
                                <div className="flex-1 prose prose-sm max-w-none prose-p:mt-0 prose-p:mb-0">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    className="text-gray-600"
                                    components={{
                                      p: ({node, ...props}) => <p className="my-0" {...props} />,
                                      a: ({node, children, ...props}) => (
                                        <a 
                                          className="text-primary-600 hover:text-primary-800" 
                                          {...props}
                                          aria-label={typeof children === 'string' ? children : 'Link'}
                                          role="link"
                                        >
                                          {children}
                                        </a>
                                      ),
                                      ul: ({node, ...props}) => <ul className="my-1" {...props} />,
                                      ol: ({node, ...props}) => <ol className="my-1" {...props} />,
                                      li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                                    }}
                                  >
                                    {step}
                                  </ReactMarkdown>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {goal.resources && goal.resources.length > 0 && (
                          <div className="mt-6">
                            <div className="flex items-center text-secondary-800 mb-3">
                              <BookOpen className="w-5 h-5 mr-2 text-primary-600" />
                              <h4 className="font-semibold">Helpful Resources</h4>
                            </div>
                            <div className="space-y-2">
                              {goal.resources.map((resource, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="flex items-start ml-7"
                                >
                                  <span className="w-2 h-2 rounded-full bg-primary-400 mr-2 mt-2 flex-shrink-0"></span>
                                  <div className="flex-1 prose prose-sm max-w-none prose-p:mt-0 prose-p:mb-0">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      className="text-primary-600"
                                      components={{
                                        p: ({node, ...props}) => <p className="my-0" {...props} />,
                                        a: ({node, children, ...props}) => (
                                          <a 
                                            className="text-primary-600 hover:text-primary-800" 
                                            {...props}
                                            aria-label={typeof children === 'string' ? children : 'Link'}
                                            role="link"
                                          >
                                            {children}
                                          </a>
                                        ),
                                        ul: ({node, ...props}) => <ul className="my-1" {...props} />,
                                        ol: ({node, ...props}) => <ol className="my-1" {...props} />,
                                        li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                                      }}
                                    >
                                      {resource.title}
                                    </ReactMarkdown>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default App;

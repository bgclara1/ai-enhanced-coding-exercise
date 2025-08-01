import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import React from 'react';

import InputForm from '../../src/components/InputForm';
import { getLLMConfig } from '../../src/config';
import { extractFlashcards } from '../../src/services/llmService';
import { fetchWikipediaContent } from '../../src/services/wikipediaService';

jest.mock('../../src/services/llmService', () => ({
  extractFlashcards: jest.fn(),
}));

jest.mock('../../src/services/wikipediaService', () => ({
  fetchWikipediaContent: jest.fn(),
}));

jest.mock('../../src/config', () => ({
  getLLMConfig: jest.fn().mockReturnValue({
    baseUrl: 'http://test-api.com',
    model: 'test-model',
    defaultApiKey: 'default-test-key',
  }),
}));

const mockExtractFlashcards = extractFlashcards as jest.MockedFunction<typeof extractFlashcards>;
const mockFetchWikipediaContent = fetchWikipediaContent as jest.MockedFunction<typeof fetchWikipediaContent>;

describe('InputForm Component', () => {
  const mockSetFlashcardSet = jest.fn();
  const mockSetLoading = jest.fn();
  const mockSetError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders input form with default elements', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    expect(screen.getByRole('button', { name: 'Wikipedia URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Flashcards' })).toBeInTheDocument();
    expect(screen.getByText('🚀 Fast Mock Mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from CSV' })).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  test('switches between URL and text input modes', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const textModeButton = screen.getByRole('button', { name: 'Custom Text' });
    fireEvent.click(textModeButton);

    expect(screen.getByRole('button', { name: 'Custom Text' })).toHaveClass('active');
    expect(screen.getByPlaceholderText('Paste your text here...')).toBeInTheDocument();

    const urlModeButton = screen.getByRole('button', { name: 'Wikipedia URL' });
    fireEvent.click(urlModeButton);

    expect(screen.getByRole('button', { name: 'Wikipedia URL' })).toHaveClass('active');
    const wikiPlaceholder = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
    expect(screen.getByPlaceholderText(wikiPlaceholder)).toBeInTheDocument();
  });

  test('shows error when submitting without input', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetError).toHaveBeenCalledWith('Please enter a Wikipedia URL or text');
  });

  test('shows error when API key is missing in config', () => {
    (getLLMConfig as jest.Mock).mockReturnValueOnce({
      baseUrl: 'http://test-api.com',
      model: 'test-model',
      defaultApiKey: '',
    });

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const inputField = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(inputField, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetError).toHaveBeenCalledWith('Please set your API key in LLM Settings');
  });

  test('processes Wikipedia URL input correctly', async () => {
    const mockWikiContent = {
      title: 'React',
      content: 'React is a JavaScript library for building user interfaces.',
    };

    const mockFlashcards = [
      { id: '1', question: 'What is React?', answer: 'A JavaScript library for building user interfaces.' },
    ];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockFetchWikipediaContent).toHaveBeenCalledWith(
        'https://en.wikipedia.org/wiki/React_(JavaScript_library)'
      );
      expect(mockExtractFlashcards).toHaveBeenCalledWith(mockWikiContent.content, undefined, expect.any(Boolean));
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        source: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)',
        cards: mockFlashcards,
      }));
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('processes custom text input correctly', async () => {
    const mockFlashcards = [
      { id: '1', question: 'What is TypeScript?', answer: 'A superset of JavaScript that adds static typing.' },
    ];

    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Switch to custom text mode
    const textModeButton = screen.getByRole('button', { name: 'Custom Text' });
    fireEvent.click(textModeButton);

    // Enter custom text
    const textInput = screen.getByPlaceholderText('Paste your text here...');
    fireEvent.change(textInput, { target: { value: 'TypeScript is a superset of JavaScript that adds static typing.' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockFetchWikipediaContent).not.toHaveBeenCalled();
      expect(mockExtractFlashcards).toHaveBeenCalledWith(
        'TypeScript is a superset of JavaScript that adds static typing.',
        undefined,
        expect.any(Boolean),
      );
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Custom Text Flashcards',
        source: 'Custom text',
        cards: mockFlashcards,
      }));
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('validates Wikipedia URL correctly', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter invalid URL
    const wikiPlaceholder = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
    const urlInput = screen.getByPlaceholderText(wikiPlaceholder);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/not-wikipedia' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetError).toHaveBeenCalledWith('Please enter a valid Wikipedia URL');
    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockSetLoading).toHaveBeenCalledWith(false);
  });

  test('extracts title from Wikipedia URL correctly', async () => {
    const mockWikiContent = {
      title: 'Artificial Intelligence',
      content: 'AI content here',
    };

    const mockFlashcards = [
      { id: '1', question: 'What is AI?', answer: 'Artificial Intelligence' },
    ];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter URL with underscores that should be converted to spaces in title
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/Artificial_intelligence' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Artificial intelligence', // Underscores replaced with spaces
        source: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      }));
    });
  });

  test('handles API errors correctly', async () => {
    // Mock the extractFlashcards function to throw an error
    mockExtractFlashcards.mockRejectedValue(new Error('API error'));

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter valid URL
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Error: API error');
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('handles Wikipedia fetch errors correctly', async () => {
    // Mock the fetchWikipediaContent function to throw an error
    mockFetchWikipediaContent.mockRejectedValue(new Error('Wikipedia API error'));

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter valid URL
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Error: Wikipedia API error');
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('passes mock mode setting to extractFlashcards', async () => {
    const mockWikiContent = {
      title: 'React',
      content: 'React content',
    };

    const mockFlashcards = [{ id: '1', question: 'Q', answer: 'A' }];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    // Mock localStorage for mock mode setting
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue('true'),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter URL
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/Test' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Verify that mock mode (true) was passed to extractFlashcards
      expect(mockExtractFlashcards).toHaveBeenCalledWith(mockWikiContent.content, undefined, true);
    });
  });

  describe('Import JSON functionality', () => {
    test('renders import JSON button', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const importButton = screen.getByRole('button', { name: 'Import from JSON' });
      expect(importButton).toBeInTheDocument();
      expect(importButton).toHaveClass('import-json');
    });

    test('import JSON button is clickable', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const importButton = screen.getByRole('button', { name: 'Import from JSON' });
      expect(importButton).not.toBeDisabled();
      
      // Test that clicking doesn't throw an error
      expect(() => fireEvent.click(importButton)).not.toThrow();
    });

    // Note: Complex file upload testing is challenging in JSDOM environment.
    // The core functionality is tested through integration tests and manual testing.
  });

  describe('Import CSV functionality', () => {
    test('renders import CSV button', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const importButton = screen.getByRole('button', { name: 'Import from CSV' });
      expect(importButton).toBeInTheDocument();
      expect(importButton).toHaveClass('import-csv');
    });

    test('import CSV button is clickable', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const importButton = screen.getByRole('button', { name: 'Import from CSV' });
      expect(importButton).not.toBeDisabled();
      
      // Test that clicking doesn't throw an error
      expect(() => fireEvent.click(importButton)).not.toThrow();
    });

    // Note: Complex file upload testing is challenging in JSDOM environment.
    // The core functionality is tested through integration tests and manual testing.
  });
});

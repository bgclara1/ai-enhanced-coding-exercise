import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InputForm from '../../src/components/InputForm';
import { extractFlashcards } from '../../src/services/llmService';
import { fetchWikipediaContent } from '../../src/services/wikipediaService';
import { getLLMConfig } from '../../src/config';
import userEvent from '@testing-library/user-event';

jest.mock('../../src/services/llmService', () => ({
  extractFlashcards: jest.fn()
}));

jest.mock('../../src/services/wikipediaService', () => ({
  fetchWikipediaContent: jest.fn()
}));

jest.mock('../../src/config', () => ({
  getLLMConfig: jest.fn().mockReturnValue({
    baseUrl: 'http://test-api.com',
    model: 'test-model',
    defaultApiKey: 'default-test-key'
  })
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
      />
    );

    expect(screen.getByRole('button', { name: 'Wikipedia URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Flashcards' })).toBeInTheDocument();
    expect(screen.getByText('🚀 Fast Mock Mode')).toBeInTheDocument();
  });

  test('switches between URL and text input modes', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
    );

    const textModeButton = screen.getByRole('button', { name: 'Custom Text' });
    fireEvent.click(textModeButton);

    expect(screen.getByRole('button', { name: 'Custom Text' })).toHaveClass('active');
    expect(screen.getByPlaceholderText('Paste your text here...')).toBeInTheDocument();

    const urlModeButton = screen.getByRole('button', { name: 'Wikipedia URL' });
    fireEvent.click(urlModeButton);

    expect(screen.getByRole('button', { name: 'Wikipedia URL' })).toHaveClass('active');
    expect(screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence')).toBeInTheDocument();
  });

  test('shows error when submitting without input', async () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetError).toHaveBeenCalledWith('Please enter a Wikipedia URL or text');
  });

  test('shows error when API key is missing in config', async () => {
    (getLLMConfig as jest.Mock).mockReturnValueOnce({
      baseUrl: 'http://test-api.com',
      model: 'test-model',
      defaultApiKey: ''
    });
    
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
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
      content: 'React is a JavaScript library for building user interfaces.'
    };
    
    const mockFlashcards = [
      { id: '1', question: 'What is React?', answer: 'A JavaScript library for building user interfaces.' }
    ];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
    );

    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockFetchWikipediaContent).toHaveBeenCalledWith('https://en.wikipedia.org/wiki/React_(JavaScript_library)');
      expect(mockExtractFlashcards).toHaveBeenCalledWith(mockWikiContent.content, undefined, expect.any(Boolean));
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        source: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)',
        cards: mockFlashcards
      }));
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('processes custom text input correctly', async () => {
    const mockFlashcards = [
      { id: '1', question: 'What is TypeScript?', answer: 'A superset of JavaScript that adds static typing.' }
    ];

    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
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
        expect.any(Boolean)
      );
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Custom Text Flashcards',
        source: 'Custom text',
        cards: mockFlashcards
      }));
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('validates Wikipedia URL correctly', async () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
    );

    // Enter invalid URL
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
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
      content: 'AI content here'
    };
    
    const mockFlashcards = [
      { id: '1', question: 'What is AI?', answer: 'Artificial Intelligence' }
    ];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
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
        source: 'https://en.wikipedia.org/wiki/Artificial_intelligence'
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
      />
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
      />
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
      content: 'React content'
    };
    
    const mockFlashcards = [{ id: '1', question: 'Q', answer: 'A' }];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    // Mock localStorage for mock mode setting
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue('true'),
      setItem: jest.fn()
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />
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

  // Import functionality tests
  describe('JSON Import', () => {
    test('successfully imports valid JSON file', async () => {
      const validJsonData = {
        title: 'Test Flashcards',
        source: 'Test Source',
        cards: [
          { id: '1', question: 'What is React?', answer: 'A JavaScript library' },
          { id: '2', question: 'What is TypeScript?', answer: 'A superset of JavaScript' }
        ],
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      const jsonBlob = new Blob([JSON.stringify(validJsonData)], { type: 'application/json' });
      const file = new File([jsonBlob], 'test.json', { type: 'application/json' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const importButton = screen.getByRole('button', { name: /import json/i });
      expect(importButton).toBeInTheDocument();

      // Simulate file selection
      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalledWith({
          title: 'Test Flashcards',
          source: 'JSON Import',
          cards: [
            { id: '1', question: 'What is React?', answer: 'A JavaScript library' },
            { id: '2', question: 'What is TypeScript?', answer: 'A superset of JavaScript' }
          ],
          createdAt: expect.any(Date)
        });
      });

      expect(mockSetError).toHaveBeenCalledWith(null);
    });

    test('handles JSON file without IDs by generating them', async () => {
      const jsonDataWithoutIds = {
        title: 'Test Flashcards',
        cards: [
          { question: 'What is React?', answer: 'A JavaScript library' }
        ]
      };

      const jsonBlob = new Blob([JSON.stringify(jsonDataWithoutIds)], { type: 'application/json' });
      const file = new File([jsonBlob], 'test.json', { type: 'application/json' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalledWith({
          title: 'Test Flashcards',
          source: 'JSON Import',
          cards: [
            { id: expect.any(String), question: 'What is React?', answer: 'A JavaScript library' }
          ],
          createdAt: expect.any(Date)
        });
      });
    });

    test('handles invalid JSON file format', async () => {
      const invalidJson = 'invalid json content';
      const jsonBlob = new Blob([invalidJson], { type: 'application/json' });
      const file = new File([jsonBlob], 'test.json', { type: 'application/json' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(expect.stringContaining('Error importing JSON'));
      });
    });

    test('handles JSON file with missing cards array', async () => {
      const invalidJsonData = {
        title: 'Test Flashcards',
        source: 'Test Source'
        // Missing cards array
      };

      const jsonBlob = new Blob([JSON.stringify(invalidJsonData)], { type: 'application/json' });
      const file = new File([jsonBlob], 'test.json', { type: 'application/json' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(expect.stringContaining('missing or invalid cards array'));
      });
    });

    test('rejects non-JSON file extension', async () => {
      const textBlob = new Blob(['some text'], { type: 'text/plain' });
      const file = new File([textBlob], 'test.txt', { type: 'text/plain' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(mockSetError).toHaveBeenCalledWith('Please select a valid JSON file');
    });
  });

  describe('CSV Import', () => {
    test('successfully imports valid CSV file', async () => {
      const csvContent = 'Question,Answer\n"What is React?","A JavaScript library"\n"What is TypeScript?","A superset of JavaScript"';
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([csvBlob], 'test.csv', { type: 'text/csv' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const importButton = screen.getByRole('button', { name: /import csv/i });
      expect(importButton).toBeInTheDocument();

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalledWith({
          title: 'Imported CSV Flashcards',
          source: 'CSV Import',
          cards: [
            { id: expect.any(String), question: 'What is React?', answer: 'A JavaScript library' },
            { id: expect.any(String), question: 'What is TypeScript?', answer: 'A superset of JavaScript' }
          ],
          createdAt: expect.any(Date)
        });
      });

      expect(mockSetError).toHaveBeenCalledWith(null);
    });

    test('handles CSV file with missing required columns', async () => {
      const csvContent = 'Title,Description\n"React","A JavaScript library"';
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([csvBlob], 'test.csv', { type: 'text/csv' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(expect.stringContaining('must contain "Question" and "Answer" columns'));
      });
    });

    test('rejects non-CSV file extension', async () => {
      const textBlob = new Blob(['some text'], { type: 'text/plain' });
      const file = new File([textBlob], 'test.txt', { type: 'text/plain' });

      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(mockSetError).toHaveBeenCalledWith('Please select a valid CSV file');
    });
  });

  describe('Import UI Interactions', () => {
    test('renders import section with buttons and info', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      expect(screen.getByText('Or Import Existing Flashcards')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import json/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import csv/i })).toBeInTheDocument();
      expect(screen.getByText(/JSON Format:/)).toBeInTheDocument();
      expect(screen.getByText(/CSV Format:/)).toBeInTheDocument();
    });

    test('clicking import buttons triggers file input', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />
      );

      const jsonButton = screen.getByRole('button', { name: /import json/i });
      const csvButton = screen.getByRole('button', { name: /import csv/i });
      
      const jsonFileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      const csvFileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      // Mock the click method
      const jsonClickSpy = jest.spyOn(jsonFileInput, 'click').mockImplementation(() => {});
      const csvClickSpy = jest.spyOn(csvFileInput, 'click').mockImplementation(() => {});

      fireEvent.click(jsonButton);
      expect(jsonClickSpy).toHaveBeenCalled();

      fireEvent.click(csvButton);
      expect(csvClickSpy).toHaveBeenCalled();

      jsonClickSpy.mockRestore();
      csvClickSpy.mockRestore();
    });
  });
});

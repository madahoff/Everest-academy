"use client";

import { useState } from "react";
import { CheckCircle, Circle, XCircle, HelpCircle, Sparkles } from "lucide-react";

interface Answer {
    id: string;
    text: string;
    isCorrect: boolean;
}

interface Question {
    id: string;
    text: string;
    answers: Answer[];
}

interface QuizSectionProps {
    questions: Question[];
}

export function QuizSection({ questions }: QuizSectionProps) {
    // Track selected answers and whether each question has been answered
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
    const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, boolean>>({});

    const handleSelectAnswer = (questionId: string, answerId: string, isCorrect: boolean) => {
        // Only allow answering once per question
        if (answeredQuestions[questionId]) return;

        setSelectedAnswers(prev => ({ ...prev, [questionId]: answerId }));
        setAnsweredQuestions(prev => ({ ...prev, [questionId]: isCorrect }));
    };

    const correctCount = Object.values(answeredQuestions).filter(Boolean).length;
    const answeredCount = Object.keys(answeredQuestions).length;
    const allAnswered = answeredCount === questions.length;

    return (
        <div className="bg-white p-10 border border-gray-100 mt-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-8 flex items-center gap-4">
                <HelpCircle className="w-4 h-4" />
                Quiz de validation <span className="text-[#2563EB]">({questions.length} questions)</span>
                <span className="h-[1px] flex-1 bg-gray-100"></span>
            </h2>

            <div className="space-y-8">
                {questions.map((question, qIndex) => {
                    const isAnswered = answeredQuestions.hasOwnProperty(question.id);
                    const isCorrectAnswer = answeredQuestions[question.id];
                    const selectedAnswerId = selectedAnswers[question.id];

                    return (
                        <div key={question.id} className="border-b border-gray-50 pb-8 last:border-0 last:pb-0">
                            <p className="font-bold text-sm mb-4 flex items-start gap-3">
                                <span className={`px-2 py-1 text-[9px] font-bold shrink-0 ${isAnswered
                                        ? isCorrectAnswer
                                            ? 'bg-green-500 text-white'
                                            : 'bg-red-500 text-white'
                                        : 'bg-[#2563EB] text-white'
                                    }`}>
                                    Q{qIndex + 1}
                                </span>
                                {question.text}
                            </p>

                            {/* Result message */}
                            {isAnswered && (
                                <div className={`mb-4 p-3 text-sm font-bold flex items-center gap-2 ${isCorrectAnswer
                                        ? 'bg-green-50 text-green-600 border border-green-200'
                                        : 'bg-red-50 text-red-600 border border-red-200'
                                    }`}>
                                    {isCorrectAnswer ? (
                                        <>
                                            <CheckCircle className="w-5 h-5" />
                                            Bonne réponse !
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="w-5 h-5" />
                                            Mauvaise réponse
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                                {question.answers.map((answer) => {
                                    const isSelected = selectedAnswerId === answer.id;
                                    let className = "flex items-center gap-3 p-3 text-xs transition-all cursor-pointer border ";

                                    if (isAnswered) {
                                        if (answer.isCorrect) {
                                            // Show correct answer in green
                                            className += "bg-green-50 border-green-300 text-green-700";
                                        } else if (isSelected && !answer.isCorrect) {
                                            // Show selected wrong answer in red
                                            className += "bg-red-50 border-red-300 text-red-700";
                                        } else {
                                            // Other answers stay gray
                                            className += "bg-gray-50 border-gray-100 text-gray-400";
                                        }
                                    } else {
                                        // Not answered yet - hoverable
                                        className += "bg-gray-50 border-gray-100 text-gray-600 hover:border-[#2563EB] hover:bg-blue-50";
                                    }

                                    return (
                                        <div
                                            key={answer.id}
                                            className={className}
                                            onClick={() => handleSelectAnswer(question.id, answer.id, answer.isCorrect)}
                                        >
                                            {isAnswered ? (
                                                answer.isCorrect ? (
                                                    <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
                                                ) : isSelected ? (
                                                    <XCircle className="w-4 h-4 shrink-0 text-red-500" />
                                                ) : (
                                                    <Circle className="w-4 h-4 shrink-0 text-gray-300" />
                                                )
                                            ) : (
                                                <Circle className="w-4 h-4 shrink-0 text-gray-300" />
                                            )}
                                            {answer.text}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Score display when all questions answered */}
            {allAnswered && (
                <div className={`mt-8 p-6 text-center ${correctCount === questions.length
                        ? 'bg-green-50 border border-green-200'
                        : correctCount >= questions.length / 2
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-red-50 border border-red-200'
                    }`}>
                    <Sparkles className={`w-8 h-8 mx-auto mb-3 ${correctCount === questions.length ? 'text-green-500' : 'text-yellow-500'
                        }`} />
                    <p className="text-lg font-bold">
                        Score : {correctCount} / {questions.length}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        {correctCount === questions.length
                            ? "Parfait ! Vous maîtrisez ce module !"
                            : correctCount >= questions.length / 2
                                ? "Bien ! Continuez à vous améliorer."
                                : "Revoyez le contenu de cette section."}
                    </p>
                </div>
            )}
        </div>
    );
}

"use client";

import { useCopilotContext } from "@copilotkit/react-core";
import { CopilotTask } from "@copilotkit/react-core";
import {
  CopilotKit,
  useMakeCopilotActionable,
  useMakeCopilotReadable,
} from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import "./styles.css";
import {
  BackwardIcon,
  ForwardIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

let globalAudio: any = undefined;

function resetGlobalAudio() {
  if (globalAudio) {
    globalAudio.pause();
    globalAudio.currentTime = 0;
  } else {
    globalAudio = new Audio();
  }
}

const Demo = () => {
  const [chatInProgress, setChatInProgress] = useState(false);
  return (
    <CopilotKit url="/api/copilotkit/">
      <CopilotSidebar
        defaultOpen={true}
        labels={{
          title: "Presentation Copilot",
          initial:
            "Hi you! 👋 I can help you create a presentation on any topic.",
        }}
        clickOutsideToClose={false}
        onInProgress={(inProgress) => {
          setChatInProgress(inProgress);
        }}
      >
        <Presentation chatInProgress={chatInProgress} />
      </CopilotSidebar>
    </CopilotKit>
  );
};

interface Slide {
  markdown: string;
  backgroundImage: string;
  speakersNotes: string;
}

async function speak(text: string) {
  const encodedText = encodeURIComponent(text);
  const url = `/api/tts?text=${encodedText}`;
  globalAudio.src = url;
  globalAudio.play();
  await new Promise<void>((resolve) => {
    globalAudio.onended = function () {
      resolve();
    };
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const Presentation = ({ chatInProgress }: { chatInProgress: boolean }) => {
  const [slides, setSlides] = useState<Slide[]>([
    {
      markdown: `# Welcome to our presentation!`,
      backgroundImage: "hello",
      speakersNotes: "",
    },
  ]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    if (!globalAudio) {
      globalAudio = new Audio();
    }
  }, []);

  const currentSlide = slides[currentSlideIndex];

  useMakeCopilotReadable("These are all the slides: " + JSON.stringify(slides));
  useMakeCopilotReadable(
    "This is the current slide: " + JSON.stringify(currentSlide)
  );

  useMakeCopilotActionable(
    {
      name: "addSlide",
      description:
        "Add a slide in the presentation you are giving. Call this function multiple times to present multiple slides.",
      argumentAnnotations: [
        {
          name: "markdown",
          type: "string",
          description:
            "The text to display in the presentation slide. Use simple markdown to outline your slide, like a headline, lists, paragraphs, etc.",
          required: true,
        },
        {
          name: "backgroundImage",
          type: "string",
          description:
            "What to display in the background of the slide (i.e. 'dog' or 'house').",
          required: true,
        },
        {
          name: "speakersNotes",
          type: "string",
          description: "The speaker's notes for this slide.",
          required: true,
        },
      ],

      implementation: async (markdown, backgroundImage, speakersNotes) => {
        // insert the new slide at the current index
        setSlides((slides) => [
          ...slides.slice(0, currentSlideIndex + 1),
          { markdown, backgroundImage, speakersNotes },
          ...slides.slice(currentSlideIndex + 1),
        ]);

        setCurrentSlideIndex((i) => i + 1);
      },
    },
    []
  );

  const context = useCopilotContext();
  const generateSlideTask = new CopilotTask({
    instructions:
      "Make the next slide related to the overall topic of the presentation. It will be inserted after the current slide.",
  });
  const [generateSlideTaskRunning, setGenerateSlideTaskRunning] =
    useState(false);

  const [editorVisible, setEditorVisible] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);

  return (
    <div className="relative">
      <SlideComponent {...currentSlide} />
      <Editor
        backgroundImage={currentSlide.backgroundImage}
        markdown={currentSlide.markdown}
        speakersNotes={currentSlide.speakersNotes}
        editorVisible={editorVisible}
        setEditorVisible={setEditorVisible}
        onUpdateSlide={(slide) => {
          setSlides((slides) => [
            ...slides.slice(0, currentSlideIndex),
            slide,
            ...slides.slice(currentSlideIndex + 1),
          ]);
        }}
      />
      <div className="absolute top-0 left-0 mt-6 ml-4">
        <ActionButton
          disabled={generateSlideTaskRunning || chatInProgress}
          onClick={() => {
            setSlides((slides) => [
              ...slides.slice(0, currentSlideIndex + 1),
              { markdown: "", backgroundImage: "random", speakersNotes: "" },
              ...slides.slice(currentSlideIndex + 1),
            ]);
            setCurrentSlideIndex((i) => i + 1);
          }}
          className="rounded-r-none"
        >
          <PlusIcon className="h-6 w-6" />
        </ActionButton>
        <ActionButton
          disabled={generateSlideTaskRunning || chatInProgress}
          onClick={async () => {
            setGenerateSlideTaskRunning(true);
            await generateSlideTask.run(context);
            setGenerateSlideTaskRunning(false);
          }}
          className="rounded-l-none ml-[1px]"
        >
          <SparklesIcon className="h-6 w-6" />
        </ActionButton>
      </div>

      <div className="absolute top-0 right-0 mt-6 mr-24">
        <ActionButton
          disabled={
            generateSlideTaskRunning || chatInProgress || slides.length === 1
          }
          onClick={() => {
            console.log("delete slide");
            // delete the current slide
            setSlides((slides) => [
              ...slides.slice(0, currentSlideIndex),
              ...slides.slice(currentSlideIndex + 1),
            ]);
            setCurrentSlideIndex((i) => 0);
          }}
          className="ml-5 rounded-r-none"
        >
          <TrashIcon className="h-6 w-6" />
        </ActionButton>

        <ActionButton
          disabled={generateSlideTaskRunning || chatInProgress || isSpeaking}
          onClick={() => {
            resetGlobalAudio();
            const speakSlideTask = new CopilotTask({
              instructions:
                "Generate a speech for the current slide. Make sure to consider the speaker's notes and to reference the slide's content.",
              includeCopilotActionable: false,
              actions: [
                {
                  name: "generateSpeech",
                  description: "Generate a speech for the current slide.",
                  argumentAnnotations: [
                    {
                      name: "text",
                      type: "string",
                      description: "The text to speak.",
                      required: true,
                    },
                  ],
                  implementation: async (text: string) => {
                    setIsSpeaking(true);
                    await speak(text);
                    setIsSpeaking(false);
                  },
                },
              ],
            });
            speakSlideTask.run(context);
          }}
          className="rounded-l-none rounded-r-none ml-[1px]"
        >
          <SpeakerWaveIcon className="h-6 w-6" />
        </ActionButton>

        <ActionButton
          disabled={generateSlideTaskRunning || chatInProgress}
          onClick={() => {
            setEditorVisible(!editorVisible);
          }}
          className="rounded-l-none ml-[1px]"
        >
          <PencilIcon className="h-6 w-6" />
        </ActionButton>
      </div>

      <div
        className="absolute bottom-0 left-0 mb-20 ml-6 text-xl"
        style={{
          textShadow:
            "1px 1px 0 #ddd, -1px -1px 0 #ddd, 1px -1px 0 #ddd, -1px 1px 0 #ddd",
        }}
      >
        Slide {currentSlideIndex + 1} of {slides.length}
      </div>

      <div className="absolute bottom-0 left-0 mb-6 ml-4">
        <ActionButton
          className="rounded-r-none"
          disabled={
            generateSlideTaskRunning ||
            currentSlideIndex === 0 ||
            chatInProgress
          }
          onClick={() => {
            setCurrentSlideIndex((i) => i - 1);
          }}
        >
          <BackwardIcon className="h-6 w-6" />
        </ActionButton>
        <ActionButton
          className="ml-[1px] rounded-l-none"
          disabled={
            generateSlideTaskRunning ||
            chatInProgress ||
            currentSlideIndex + 1 === slides.length
          }
          onClick={async () => {
            setCurrentSlideIndex((i) => i + 1);
          }}
        >
          <ForwardIcon className="h-6 w-6" />
        </ActionButton>
      </div>
    </div>
  );
};

const Editor = (props: {
  editorVisible: boolean;
  setEditorVisible: (visible: boolean) => void;
  onUpdateSlide: (slide: Slide) => void;
  backgroundImage: string;
  markdown: string;
  speakersNotes: string;
}) => {
  const [backgroundImage, setBackgroundImage] = useState(props.backgroundImage);
  const [markdown, setMarkdown] = useState(props.markdown);
  const [speakersNotes, setSpeakersNotes] = useState(props.speakersNotes);

  useEffect(() => {
    setBackgroundImage(props.backgroundImage);
    setMarkdown(props.markdown);
    setSpeakersNotes(props.speakersNotes);
  }, [props.backgroundImage, props.markdown, props.speakersNotes]);

  return (
    <div className={props.editorVisible ? "" : "hidden"}>
      <div className="w-[500px] h-[420px] bg-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border border-gray-200 shadow-lg rounded-md p-5">
        <form className="space-y-4">
          <div>
            <label
              htmlFor="backgroundImage"
              className="block text-sm font-medium text-gray-700"
            >
              Background Image
            </label>
            <input
              type="text"
              value={backgroundImage}
              onChange={(e) => setBackgroundImage(e.target.value)}
              id="backgroundImage"
              name="backgroundImage"
              placeholder="what should be in the background? (e.g. 'dog', 'house')"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium text-gray-700"
            >
              Content
            </label>
            <textarea
              id="content"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              name="content"
              rows={3}
              placeholder="The content of the slide..."
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            ></textarea>
          </div>

          <div>
            <label
              htmlFor="speakersNotes"
              className="block text-sm font-medium text-gray-700"
            >
              Speaker's Notes
            </label>
            <textarea
              id="speakersNotes"
              value={speakersNotes}
              onChange={(e) => setSpeakersNotes(e.target.value)}
              name="speakersNotes"
              rows={3}
              placeholder="Enter speaker's notes here..."
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            ></textarea>
          </div>

          <div className="flex justify-end items-center space-x-4">
            <button
              type="button"
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => props.setEditorVisible(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{ backgroundColor: "rgb(99 102 241)" }}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-500  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => {
                props.onUpdateSlide({
                  markdown,
                  backgroundImage,
                  speakersNotes,
                });
                props.setEditorVisible(false);
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ActionButton = ({
  disabled,
  onClick,
  className,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <button
      disabled={disabled}
      className={`bg-blue-500 text-white font-bold py-2 px-4 rounded
      ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}
      ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

const SlideComponent = ({ markdown, backgroundImage }: Slide) => {
  backgroundImage =
    'url("https://source.unsplash.com/featured/?' +
    encodeURIComponent(backgroundImage) +
    '")';
  return (
    <div
      className="h-screen w-full flex flex-col justify-center items-center text-5xl text-white bg-cover bg-center bg-no-repeat p-10 text-center"
      style={{
        backgroundImage,
        textShadow:
          "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
      }}
    >
      <Markdown className="markdown">{markdown}</Markdown>
    </div>
  );
};

export default Demo;

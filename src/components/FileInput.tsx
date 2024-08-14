import { FC, useId } from "react";

export type FileInputProps = {
  onChange: (file: File) => void;
  accept?: string;
  description?: string
}

export const FileInput: FC<FileInputProps> = ({ onChange, accept, description }) => {
  const id = useId()
  return (
    <>
      <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white" htmlFor={id}>Выбрать XML</label>
      <input className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" aria-describedby="file_input_help" id={id} type="file" accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            onChange(file)
          }
        }}
      />
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-300" id="file_input_help">{description}</p>
    </>
  )
}

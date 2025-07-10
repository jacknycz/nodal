declare module 'pres-start-core' {
  export interface ButtonProps {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
    variant?: string
    [key: string]: any
  }

  export interface HeadingProps {
    children?: React.ReactNode
    size?: string
    className?: string
    [key: string]: any
  }

  export interface ButtonGroupProps {
    children?: React.ReactNode
    className?: string
    [key: string]: any
  }

  export const Button: React.FC<ButtonProps>
  export const Heading: React.FC<HeadingProps>
  export const ButtonGroup: React.FC<ButtonGroupProps>
} 
import styled from 'styled-components'
import { memo } from 'react'

const SelectorWrapper = styled.div`
  display: inline-flex;
  background: rgba(20, 20, 20, 0.9);
  border-radius: 20px;
  padding: 4px;
  gap: 4px;
`

const Option = styled.button`
  position: relative;
  background: ${props => props.$active ? 'rgba(45, 45, 45, 0.95)' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'rgba(255, 255, 255, 0.5)'};
  border: none;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Oswald', sans-serif;
  letter-spacing: 0.5px;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 16px;
    transition: all 0.2s ease;
    opacity: ${props => props.$active ? 1 : 0};
    box-shadow: ${props => props.$active ? 
      `inset 0 0 0 1px rgba(255, 255, 255, 0.1),
       0 0 0 1px rgba(255, 255, 255, 0.05)` : 'none'};
  }

  &:hover {
    color: white;
    background: ${props => props.$active ? 
      'rgba(45, 45, 45, 0.95)' : 
      'rgba(40, 40, 40, 0.5)'};
  }

  &:focus {
    outline: none;
  }

  ${props => props.$active && `
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    font-weight: 500;
  `}
`

export const Selector = memo(function Selector({ options, value, onChange }) {

    return (
        <SelectorWrapper>
            {options.map(option => (
                <Option
                    key={option}
                    $active={option === value}
                    onClick={() => onChange?.(option)}
                >
                    {option}
                </Option>
            ))}
        </SelectorWrapper>
    )
})
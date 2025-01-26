import { useState, useRef } from "react";
import styled from "styled-components";
import Button from "./Button";

const InputWrapper = styled.div`
    .input-container {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;

        input {
            background: rgb(40,40,40);
            border: ${props => props.error ? '1px solid rgb(200,100,100)' : '1px solid rgb(70,70,70)'};
            border-radius: 4px;
            padding: 8px 12px;
            color: white;
            outline: none;
            width: 100%;

            &:focus {
                border-color: rgb(100,100,100);
            }

            &::placeholder {
                color: rgb(120,120,120);
            }
        }
    }

    .error-message {
        color: rgb(200,100,100);
        font-size: 12px;
        margin-top: 4px;
    }
`;

export function Input({ 
    onSubmit = () => {}, 
    defaultInput = '', 
    disabled = false, 
    placeholder = 'Type Here...', 
    clearOnSubmit = false, 
    buttonText = "Search",
    error = null, // New prop for error handling
    type = 'text',
    style = {},
    containerStyle = {},
    onChange = () => {},
    hideSubmit = false,
    customInputValue = undefined
}) {
    const [inputValue, setInputValue] = useState(defaultInput);
    const inputRef = useRef(null);

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
        onChange?.(e.target.value);
    };

    const handleSubmit = () => {
        if (clearOnSubmit) {
            setInputValue('')
        }
        if (onSubmit) {
            onSubmit(inputValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <InputWrapper error={error} style={style}>
            <div className="input-container" style={containerStyle}>
                <div style={{ paddingRight: 20 }}>
                    <input
                        ref={inputRef}
                        type={type}
                        value={customInputValue ?? inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled}
                    />
                </div>
                {!hideSubmit ? <Button 
                    onClick={handleSubmit} 
                    disabled={disabled}
                    text={buttonText}
                    textAlign="center"
                /> : ''}
            </div>
            {error && <div className="error-message">{error}</div>}
        </InputWrapper>
    );
}
export default Input
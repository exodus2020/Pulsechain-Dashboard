import styled from 'styled-components'
import { useEffect } from 'react'

const ToastContainer = styled.div`
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 1000;
`

const ToastMessage = styled.div`
    background: rgba(20, 20, 20, 1);
    box-shadow: 0 0 1px 1px rgba(70, 70, 70, 1);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    animation: ${({ isLeaving }) => isLeaving ? 'fadeOut' : 'fadeIn'} 0.3s ease-in-out;
    opacity: ${({ isLeaving }) => isLeaving ? 0 : 1};
    transform: translateX(${({ isLeaving }) => isLeaving ? '-20px' : '0'});
    transition: all 0.3s ease-in-out;

    @keyframes fadeIn {
        from { 
            opacity: 0;
            transform: translateX(20px);
        }
        to { 
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes fadeOut {
        from { 
            opacity: 1;
            transform: translateX(0);
        }
        to { 
            opacity: 0;
            transform: translateX(-20px);
        }
    }
`

export function Toast({ messages, onRemove }) {
    useEffect(() => {
        messages.forEach(msg => {
            const timer = setTimeout(() => {
                onRemove(msg.id)
            }, 2000)

            return () => clearTimeout(timer)
        })
    }, [messages, onRemove])

    return (
        <ToastContainer>
            {messages.map((msg) => (
                <ToastMessage key={msg.id}>
                    {msg.text}
                </ToastMessage>
            ))}
        </ToastContainer>
    )
} 